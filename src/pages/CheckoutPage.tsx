import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { usePageMeta } from "../hooks/usePageMeta";
import { trackEvent } from "../lib/analytics";
import { formatPrice } from "../lib/format";
import { buildWhatsAppOrderMessage, createWhatsAppUrl } from "../lib/whatsapp";
import { selectCartSubtotal, useCartStore } from "../store/cart";
import type { CustomerDetails } from "../types/catalog";
import type { CartItem } from "../types/catalog";
import { catalogPreview } from "../lib/config";
import { supabase } from "../lib/supabase";

const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name."),
  phone: z.string().trim().min(7, "Enter a valid phone number.").max(30),
  email: z.string().trim().email("Enter a valid email address."),
  shippingAddress: z.string().trim().min(10, "Enter the delivery address, including country."),
  note: z.string().trim().max(500, "Keep the note under 500 characters.").optional(),
  consent: z.literal(true, { error: "Confirm that this is an order request before continuing." })
});

type CheckoutValues = z.infer<typeof checkoutSchema>;

export function CheckoutPage() {
  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore(selectCartSubtotal);
  const [readyMessage, setReadyMessage] = useState<string | null>(null);
  const requestAttempt = useRef({ fingerprint: "", key: "" });
  const [readyUrl, setReadyUrl] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CheckoutValues>({ resolver: zodResolver(checkoutSchema) });
  usePageMeta({ title: "Checkout via WhatsApp | Fieldio", description: "Prepare your Fieldio order request and continue securely on WhatsApp.", canonical: "https://fieldio.shop/checkout" });

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
      trackEvent("whatsapp_checkout_started", { items: items.length });
      if (!catalogPreview) window.location.assign(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your request could not be prepared. Please try again.");
      setReadyMessage("The order request was not completed. Review your bag and try again, or contact Fieldio for assistance.");
    }
  };

  if (!items.length) return <div className="empty-checkout"><h1>Your bag is empty.</h1><p>Add a piece before preparing a WhatsApp request.</p><Link to="/collections" className="primary-button">Explore the edit</Link></div>;

  return (
    <div className="checkout-page">
      <header className="checkout-heading"><h1>Complete your request</h1><p>No payment is taken here. Fieldio will confirm availability, shipping, and payment with you on WhatsApp.</p></header>
      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate>
          <h2>Customer & delivery</h2>
          <div className="form-grid">
            <label><span>Full name</span><input autoComplete="name" {...register("name")} aria-invalid={Boolean(errors.name)} />{errors.name && <small>{errors.name.message}</small>}</label>
            <label><span>Phone number</span><input type="tel" autoComplete="tel" {...register("phone")} aria-invalid={Boolean(errors.phone)} />{errors.phone && <small>{errors.phone.message}</small>}</label>
            <label className="form-span"><span>Email address</span><input type="email" autoComplete="email" {...register("email")} aria-invalid={Boolean(errors.email)} />{errors.email && <small>{errors.email.message}</small>}</label>
            <label className="form-span"><span>Shipping address</span><textarea rows={4} autoComplete="street-address" {...register("shippingAddress")} aria-invalid={Boolean(errors.shippingAddress)} />{errors.shippingAddress && <small>{errors.shippingAddress.message}</small>}</label>
            <label className="form-span"><span>Note <em>Optional</em></span><textarea rows={3} {...register("note")} />{errors.note && <small>{errors.note.message}</small>}</label>
          </div>
          <label className="request-consent"><input type="checkbox" {...register("consent")} /><span>I understand this sends an order request and does not confirm availability or payment.</span></label>
          {errors.consent && <p className="field-error">{errors.consent.message}</p>}
          {readyMessage && <p className="ready-message" role="status">{readyMessage}</p>}
          {readyUrl && <a className="text-link" href={readyUrl}>Open prepared WhatsApp message</a>}
          <button className="primary-button checkout-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? "Preparing request…" : "Continue on WhatsApp"}</button>
        </form>
        <aside className="order-review" aria-labelledby="review-title">
          <h2 id="review-title">Your request</h2>
          <ul>{items.map((item) => <li key={item.key}><img src={item.image} alt="" /><div><p>{item.brand}</p><h3>{item.productName}</h3><span>{item.selectedVariant} · Qty {item.quantity}</span></div><strong>{formatPrice(item.unitPrice, item.currency)}</strong></li>)}</ul>
          <div className="review-total"><span>Subtotal</span><strong>{subtotal === null ? "To be confirmed" : formatPrice(subtotal, items[0]?.currency ?? "GBP")}</strong></div>
          <p>Shipping and any sourcing fees are confirmed before payment.</p>
        </aside>
      </div>
    </div>
  );
}
