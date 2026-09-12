import { track } from "@vercel/analytics";

type AnalyticsEvent =
  | "page_view"
  | "product_view"
  | "size_selection"
  | "quantity_change"
  | "quick_add"
  | "search"
  | "add_to_cart"
  | "remove_from_cart"
  | "whatsapp_checkout_started"
  | "wishlist_addition"
  | "newsletter_signup";

export function trackEvent(name: AnalyticsEvent, properties: Record<string, string | number | boolean> = {}): void {
  if (import.meta.env.DEV) {
    console.info(`[analytics] ${name}`, properties);
    return;
  }

  window.dispatchEvent(new CustomEvent("fieldio:analytics", { detail: { name, properties } }));
  if (localStorage.getItem("fieldio-analytics-consent") === "accepted") track(name, properties);
}
