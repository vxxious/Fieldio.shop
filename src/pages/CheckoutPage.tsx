import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { usePageMeta } from "../hooks/usePageMeta";
import { emptyCatalog, useCatalogProducts } from "../hooks/useCatalog";
import { useLocale } from "../context/LocaleContext";
import { trackEvent } from "../lib/analytics";
import { buildWhatsAppOrderMessage, createWhatsAppUrl } from "../lib/whatsapp";
import { groupCartItemsByStore, selectCartSubtotal, useCartStore } from "../store/cart";
import type { CustomerDetails } from "../types/catalog";
import type { CartItem } from "../types/catalog";
import { catalogPreview } from "../lib/config";
import { supabase } from "../lib/supabase";
import { useSession } from "../hooks/useSession";
import { deliveryGuidance, returnEligibility } from "../lib/product-trust";

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
export const checkoutAttemptKey = "fieldio-checkout-attempt-v1";
export const checkoutConfirmationKey = "fieldio-checkout-confirmation-v1";

const checkoutAttemptSchema = z.object({ userId: z.string().uuid(), fingerprint: z.string().min(1), key: z.string().uuid() });
const checkoutConfirmationSchema = z.object({
  userId: z.string().uuid(),
  reference: z.string().max(80).regex(/^FLD-[A-Z0-9-]+$/),
  paymentStatus: z.enum(["pending", "confirmed"]),
  groups: z.array(z.object({ storeName: z.string().min(1).max(160), itemCount: z.number().int().nonnegative() })),
  cartSignature: z.string().min(1)
});
type CheckoutAttempt = z.infer<typeof checkoutAttemptSchema>;
type CheckoutConfirmation = z.infer<typeof checkoutConfirmationSchema>;

function getRegionName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function readCheckoutDraft(): Partial<CheckoutValues> {
  try {
    return JSON.parse(sessionStorage.getItem(checkoutDraftKey) || "{}") as Partial<CheckoutValues>;
  } catch {
    return {};
  }
}

function readSessionValue<T>(key: string, schema: z.ZodType<T>): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(sessionStorage.getItem(key) || "null"));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeSessionValue(key: string, value: unknown): boolean {
  try { sessionStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

function removeSessionValue(key: string): void {
  try { sessionStorage.removeItem(key); } catch { /* Storage may be unavailable in restricted browsing contexts. */ }
}

function getCartSignature(items: CartItem[]): string {
  return JSON.stringify(items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })));
}

function getConfirmationWhatsAppUrl(reference: string): string {
  return createWhatsAppUrl(`Hello Fieldio, I am continuing with order request ${reference}.`);
}

export function CheckoutPage() {
  const { formatMoney, language, region, t } = useLocale();
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const subtotal = useCartStore(selectCartSubtotal);
  const [readyMessage, setReadyMessage] = useState<string | null>(null);
  const requestAttempt = useRef<CheckoutAttempt | null>(readSessionValue(checkoutAttemptKey, checkoutAttemptSchema));
  const [confirmationState, setConfirmationState] = useState(() => {
    const value = readSessionValue(checkoutConfirmationKey, checkoutConfirmationSchema);
    return { value, stored: Boolean(value) };
  });
  const confirmation = confirmationState.value;
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const checkoutEdited = useRef(false);
  const { session, loading: sessionLoading } = useSession();
  const { data: catalog = emptyCatalog } = useCatalogProducts();
  const storeGroups = groupCartItemsByStore(items, catalog);
  const cartSignature = getCartSignature(items);
  const storedConfirmation = confirmationState.stored ? readSessionValue(checkoutConfirmationKey, checkoutConfirmationSchema) : confirmation;
  const activeConfirmation = confirmation && storedConfirmation?.reference === confirmation.reference && session?.user.id === confirmation.userId && (!items.length || confirmation.cartSignature === cartSignature) ? confirmation : null;
  const [draft] = useState(readCheckoutDraft);
  const delivery = deliveryGuidance(region.code);
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
  usePageMeta({ title: "Checkout | Fieldio", description: "Send your Fieldio order request, then continue securely on WhatsApp.", canonical: "https://fieldio.shop/checkout" });

  useEffect(() => {
    if (!confirmation || sessionLoading) return;
    if (!session || confirmation.userId !== session.user.id || (items.length > 0 && confirmation.cartSignature !== cartSignature)) {
      removeSessionValue(checkoutConfirmationKey);
      return;
    }
    if (items.length > 0) clearCart();
  }, [cartSignature, clearCart, confirmation, items.length, session, sessionLoading]);

  useEffect(() => {
    if (!activeConfirmation) return;
    window.requestAnimationFrame(() => confirmationHeading.current?.focus());
  }, [activeConfirmation]);

  useEffect(() => {
    if (!savedDetails.data || isDirty || checkoutEdited.current) return;
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
    const customer: CustomerDetails = { name: values.name, phone: values.phone, email: values.email, shippingAddress: values.shippingAddress, ...(values.note ? { note: values.note } : {}) };
    setReadyMessage(null);
    try {
      if (catalogPreview) {
        trackEvent("whatsapp_checkout_started", { items: items.length, source: "catalog_preview" });
        window.location.assign(createWhatsAppUrl(buildWhatsAppOrderMessage(customer, items)));
        return;
      }
      if (!session?.user.id) throw new Error("Your account session has expired. Sign in again before sending this request.");
      if (!requestAttempt.current || requestAttempt.current.userId !== session.user.id || requestAttempt.current.fingerprint !== fingerprint) {
        requestAttempt.current = { userId: session.user.id, fingerprint, key: crypto.randomUUID() };
        writeSessionValue(checkoutAttemptKey, requestAttempt.current);
      }
      const requestKey = requestAttempt.current.key;
      const auth = await supabase?.auth.getSession();
      const token = auth?.data.session?.access_token;
      const response = await fetch("/api/order-requests", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ requestKey, customer, items: items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })) }) });
      const result = await response.json() as { error?: string; reference?: string; paymentStatus?: "pending" | "confirmed"; groups?: Array<{ storeName: string; itemCount: number }>; items?: CartItem[] };
      if (!response.ok || !result.reference || !result.items?.length || !result.paymentStatus) throw new Error(result.error || "Your request could not be prepared. Please try again.");
      const nextConfirmation: CheckoutConfirmation = {
        userId: session.user.id,
        reference: result.reference,
        paymentStatus: result.paymentStatus,
        groups: result.groups?.length ? result.groups : storeGroups.map((group) => ({ storeName: group.name, itemCount: group.items.reduce((count, item) => count + item.quantity, 0) })),
        cartSignature
      };
      setConfirmationState({ value: nextConfirmation, stored: writeSessionValue(checkoutConfirmationKey, nextConfirmation) });
      removeSessionValue(checkoutDraftKey);
      removeSessionValue(checkoutAttemptKey);
      requestAttempt.current = null;
      clearCart();
      trackEvent("order_request_created", { items: items.length, stores: nextConfirmation.groups.length });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your request could not be prepared. Please try again.");
      setReadyMessage(t("checkout.failed"));
    }
  };

  if (confirmation && sessionLoading) return <div className="route-loading" role="status">{t("common.loading")}…</div>;

  if (activeConfirmation) return (
    <main className="checkout-confirmation" aria-labelledby="checkout-confirmation-title">
      <p className="checkout-confirmation-eyebrow">{t("checkout.confirmationEyebrow")}</p>
      <h1 ref={confirmationHeading} id="checkout-confirmation-title" tabIndex={-1}>{t("checkout.confirmationTitle")}</h1>
      <p className="checkout-confirmation-intro" role="status">{t("checkout.confirmationReceived")}</p>
      <dl className="checkout-confirmation-ledger">
        <div><dt>{t("checkout.reference")}</dt><dd>{activeConfirmation.reference}</dd></div>
        <div><dt>{t("checkout.paymentState")}</dt><dd>{activeConfirmation.paymentStatus === "confirmed" ? t("checkout.paymentConfirmed") : t("checkout.paymentPending")}</dd></div>
      </dl>
      <section className="checkout-confirmation-stores" aria-labelledby="confirmation-stores-title">
        <h2 id="confirmation-stores-title">{t("checkout.storeProgress")}</h2>
        {activeConfirmation.groups.length > 1 && <p>{t("checkout.confirmationMultiStore")}</p>}
        <ul>{activeConfirmation.groups.map((group, index) => <li key={`${group.storeName}-${index}`}><span>{group.storeName}</span><span>{group.itemCount} {group.itemCount === 1 ? "item" : "items"}</span></li>)}</ul>
      </section>
      <section className="checkout-confirmation-next" aria-labelledby="confirmation-next-title">
        <h2 id="confirmation-next-title">{t("checkout.nextStep")}</h2>
        <p>{t("checkout.nextStepCopy")}</p>
      </section>
      <div className="checkout-confirmation-actions">
        <a className="primary-button" href={getConfirmationWhatsAppUrl(activeConfirmation.reference)} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent("whatsapp_checkout_started", { reference: activeConfirmation.reference, source: "order_confirmation" })}>{t("checkout.continueWhatsApp")}</a>
        <Link className="text-link" to="/account?view=orders">{t("checkout.viewOrders")}</Link>
      </div>
    </main>
  );

  if (!items.length) return <div className="empty-checkout"><h1>{t("checkout.emptyTitle")}</h1><p>{t("checkout.emptyCopy")}</p><div className="empty-actions"><Link to="/collections" className="primary-button">{t("checkout.explore")}</Link>{!session && <Link to="/account?returnTo=/checkout" className="text-link">{t("checkout.accountPrompt")}</Link>}</div></div>;

  return (
    <div className="checkout-page">
      <header className="checkout-heading"><h1>{t("checkout.title")}</h1><p>{t("checkout.notice")}</p></header>
      <div className="checkout-layout">
        <form className="checkout-form" onChangeCapture={() => { checkoutEdited.current = true; }} onSubmit={(event) => void handleSubmit(onSubmit, (formErrors) => setFocus(Object.keys(formErrors)[0] as keyof CheckoutValues))(event)} noValidate>
          <h2>{t("checkout.customer")}</h2>
          {session && savedDetails.isPending && <p className="form-helper" role="status">{t("checkout.loadingDetails")}</p>}
          {savedDetails.error && <p className="form-helper" role="status">{t("checkout.detailsError")}</p>}
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
          <button className="primary-button checkout-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? t("checkout.preparing") : t("checkout.submit")}</button>
        </form>
        <aside className="order-review" aria-labelledby="review-title">
          <h2 id="review-title">{t("checkout.request")}</h2>
          {storeGroups.length > 1 && <p className="checkout-multistore-note">{t("checkout.multiStore")}</p>}
          <div className="checkout-store-groups">{storeGroups.map((group) => (
            <section className="checkout-store-group" key={group.key} aria-labelledby={`checkout-store-${group.key}`}>
              <h3 className="checkout-store-name" id={`checkout-store-${group.key}`}>{group.name}</h3>
              <ul>{group.items.map((item) => <li key={item.key}><img src={item.image} alt="" /><div><p>{item.brand}</p><h4>{item.productName}</h4><span>{item.selectedVariant} · {t("checkout.quantity")} {item.quantity}</span></div><strong>{formatMoney(item.unitPrice === null ? null : item.unitPrice * item.quantity, item.currency)}</strong></li>)}</ul>
            </section>
          ))}</div>
          <div className="review-total"><span>{t("cart.subtotal")}</span><strong>{subtotal === null ? t("cart.confirm") : formatMoney(subtotal, items[0]?.currency ?? "GBP")}</strong></div>
          <p>{t("checkout.shipping")}</p>
          <div className="checkout-assurance">
            <section>
              <h3>{t("checkout.destination")}</h3>
              <strong>{getRegionName(region.code, language.locale)} · {region.currency}</strong>
              <p>{delivery.estimate} Sourcing time, carrier, and final cost are confirmed before payment.</p>
              <p>{delivery.duties}</p>
            </section>
            <section>
              <h3>Returns</h3>
              <p>{returnEligibility}</p>
            </section>
            <section>
              <h3>{t("checkout.paymentTitle")}</h3>
              <p>{t("checkout.paymentMethods")}</p>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
