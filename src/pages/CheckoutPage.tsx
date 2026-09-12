import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { usePageMeta } from "../hooks/usePageMeta";
import { useLocale } from "../context/LocaleContext";
import { trackEvent } from "../lib/analytics";
import { buildWhatsAppOrderMessage, createWhatsAppUrl } from "../lib/whatsapp";
import { selectCartSubtotal, useCartStore } from "../store/cart";
import type { CustomerDetails } from "../types/catalog";
import type { CartItem } from "../types/catalog";
import { catalogPreview } from "../lib/config";
import { supabase } from "../lib/supabase";
import { useSession } from "../hooks/useSession";

const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name."),
  phone: z.string().trim().min(7, "Enter a valid phone number.").max(30),
  email: z.string().trim().email("Enter a valid email address."),
  shippingAddress: z.string().trim().min(10, "Enter the delivery address, including country."),
  note: z.string().trim().max(500, "Keep the note under 500 characters.").optional(),
  consent: z.boolean().refine(Boolean, "Confirm that this is an order request before continuing.")
});

type CheckoutValues = z.infer<typeof checkoutSchema>;
const checkoutDraftKey = "fieldio-checkout-draft";

function readCheckoutDraft(): Partial<CheckoutValues> {
  try {
    return JSON.parse(sessionStorage.getItem(checkoutDraftKey) || "{}") as Partial<CheckoutValues>;
  } catch {
    return {};
  }
}

export function CheckoutPage() {
  const { formatMoney, t } = useLocale();
  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore(selectCartSubtotal);
  const [readyMessage, setReadyMessage] = useState<string | null>(null);
  const requestAttempt = useRef({ fingerprint: "", key: "" });
  const [readyUrl, setReadyUrl] = useState("");
  const { session } = useSession();
  const [draft] = useState(readCheckoutDraft);
  const { control, register, handleSubmit, reset, setFocus, formState: { errors, isSubmitting, isDirty } } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { name: "", phone: "", email: "", shippingAddress: "", note: "", consent: false, ...draft }
  });
  const checkoutValues = useWatch({ control });
  const savedDetails = useQuery({
    queryKey: ["checkout-details", session?.user.id],
    enabled: Boolean(session?.user.id && supabase),
    queryFn: async () => {
      const userId = session!.user.id;
      const [profile, address] = await Promise.all([
        supabase!.from("profiles").select("full_name,phone").eq("id", userId).maybeSingle(),
        supabase!.from("addresses").select("line1,line2,city,region,postal_code,country_code").eq("user_id", userId).eq("is_default", true).maybeSingle()
      ]);
      if (profile.error || address.error) throw profile.error || address.error;
      return { profile: profile.data, address: address.data };
    }
  });
  usePageMeta({ title: "Checkout via WhatsApp | Fieldio", description: "Prepare your Fieldio order request and continue securely on WhatsApp.", canonical: "https://fieldio.shop/checkout" });

  useEffect(() => {
    if (!savedDetails.data || isDirty) return;
    const { profile, address } = savedDetails.data;
    const shippingAddress = address ? [address.line1, address.line2, address.city, address.region, address.postal_code, address.country_code].filter(Boolean).join(", ") : "";
    reset({
      name: draft.name || profile?.full_name || "",
      phone: draft.phone || profile?.phone || "",
      email: draft.email || session?.user.email || "",
      shippingAddress: draft.shippingAddress || shippingAddress,
      note: draft.note || "",
      consent: false
    });
  }, [draft, isDirty, reset, savedDetails.data, session?.user.email]);

  useEffect(() => {
    const { name, phone, email, shippingAddress, note } = checkoutValues;
    sessionStorage.setItem(checkoutDraftKey, JSON.stringify({ name, phone, email, shippingAddress, note }));
  }, [checkoutValues]);

  const onSubmit = async (values: CheckoutValues) => {
    const fingerprint = JSON.stringify({ values, items: items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })) });
    if (requestAttempt.current.fingerprint !== fingerprint) requestAttempt.current = { fingerprint, key: crypto.randomUUID() };
    const requestKey = requestAttempt.current.key;
    const customer: CustomerDetails = { name: values.name, phone: values.phone, email: values.email, shippingAddress: values.shippingAddress, ...(values.note ? { note: values.note } : {}) };
    setReadyMessage(null);
    try {
      let verifiedItems = items;
      let reference = "";
      if (!catalogPreview) {
        const session = await supabase?.auth.getSession();
        const token = session?.data.session?.access_token;
        const response = await fetch("/api/order-requests", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ requestKey, customer, items: items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })) }) });
        const result = await response.json() as { error?: string; reference?: string; items?: CartItem[] };
        if (!response.ok || !result.reference || !result.items?.length) throw new Error(result.error || "Your request could not be prepared. Please try again.");
        verifiedItems = result.items;
        reference = `\nReference: ${result.reference}`;
      }
      const message = buildWhatsAppOrderMessage(customer, verifiedItems) + reference;
      const url = createWhatsAppUrl(message);
      setReadyUrl(url);
      setReadyMessage("Your order request is ready. Continue on WhatsApp to confirm availability, shipping, and payment.");
      sessionStorage.removeItem(checkoutDraftKey);
      trackEvent("whatsapp_checkout_started", { items: items.length });
      if (!catalogPreview) window.location.assign(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your request could not be prepared. Please try again.");
      setReadyMessage("The order request was not completed. Review your bag and try again, or contact Fieldio for assistance.");
    }
  };

  if (!items.length) return <div className="empty-checkout"><h1>Your bag is empty.</h1><p>Add a piece before preparing a WhatsApp request.</p><div className="empty-actions"><Link to="/collections" className="primary-button">Explore the edit</Link>{!session && <Link to="/account?returnTo=/checkout" className="text-link">Have an account? Sign in to check out faster</Link>}</div></div>;

  return (
    <div className="checkout-page">
      <header className="checkout-heading"><h1>{t("checkout.title")}</h1><p>{t("checkout.notice")}</p></header>
      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={(event) => void handleSubmit(onSubmit, (formErrors) => setFocus(Object.keys(formErrors)[0] as keyof CheckoutValues))(event)} noValidate>
          <h2>{t("checkout.customer")}</h2>
          {session && savedDetails.isPending && <p className="form-helper" role="status">Loading your saved details…</p>}
          {savedDetails.error && <p className="form-helper" role="status">Saved details could not be loaded. You can still continue by entering them below.</p>}
          <div className="form-grid">
            <label><span>{t("checkout.name")}</span><input autoComplete="name" {...register("name")} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "checkout-name-error" : undefined} />{errors.name && <small id="checkout-name-error" role="alert">{errors.name.message}</small>}</label>
            <label><span>{t("checkout.phone")}</span><input type="tel" autoComplete="tel" {...register("phone")} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "checkout-phone-error" : undefined} />{errors.phone && <small id="checkout-phone-error" role="alert">{errors.phone.message}</small>}</label>
            <label className="form-span"><span>{t("checkout.email")}</span><input type="email" autoComplete="email" {...register("email")} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "checkout-email-error" : undefined} />{errors.email && <small id="checkout-email-error" role="alert">{errors.email.message}</small>}</label>
            <label className="form-span"><span>{t("checkout.address")}</span><textarea rows={4} autoComplete="street-address" {...register("shippingAddress")} aria-invalid={Boolean(errors.shippingAddress)} aria-describedby={errors.shippingAddress ? "checkout-address-error" : undefined} />{errors.shippingAddress && <small id="checkout-address-error" role="alert">{errors.shippingAddress.message}</small>}</label>
            <label className="form-span"><span>{t("checkout.note")} <em>{t("checkout.optional")}</em></span><textarea rows={3} {...register("note")} aria-invalid={Boolean(errors.note)} aria-describedby={errors.note ? "checkout-note-error" : undefined} />{errors.note && <small id="checkout-note-error" role="alert">{errors.note.message}</small>}</label>
          </div>
          <label className="request-consent"><input type="checkbox" {...register("consent")} aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? "checkout-consent-error" : undefined} /><span>{t("checkout.consent")}</span></label>
          {errors.consent && <p id="checkout-consent-error" className="field-error" role="alert">{errors.consent.message}</p>}
          {readyMessage && <p className="ready-message" role="status">{readyMessage}</p>}
          {readyUrl && <a className="text-link" href={readyUrl}>Open prepared WhatsApp message</a>}
          <button className="primary-button checkout-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? t("checkout.preparing") : t("checkout.continue")}</button>
        </form>
        <aside className="order-review" aria-labelledby="review-title">
          <h2 id="review-title">{t("checkout.request")}</h2>
          <ul>{items.map((item) => <li key={item.key}><img src={item.image} alt="" /><div><p>{item.brand}</p><h3>{item.productName}</h3><span>{item.selectedVariant} · Qty {item.quantity}</span></div><strong>{formatMoney(item.unitPrice, item.currency)}</strong></li>)}</ul>
          <div className="review-total"><span>{t("cart.subtotal")}</span><strong>{subtotal === null ? t("cart.confirm") : formatMoney(subtotal, items[0]?.currency ?? "GBP")}</strong></div>
          <p>{t("checkout.shipping")}</p>
        </aside>
      </div>
    </div>
  );
}
