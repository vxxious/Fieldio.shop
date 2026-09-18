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

const campaignKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export function getCampaignAttribution(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  return Object.fromEntries(campaignKeys.flatMap((key) => {
    const value = params.get(key)?.trim().slice(0, 100);
    return value ? [[key, value]] : [];
  }));
}

export function trackEvent(name: AnalyticsEvent, properties: Record<string, string | number | boolean> = {}): void {
  if (import.meta.env.DEV) {
    console.info(`[analytics] ${name}`, properties);
    return;
  }

  const consented = localStorage.getItem("fieldio-analytics-consent") === "accepted";
  const eventProperties = consented && name === "page_view"
    ? { ...getCampaignAttribution(window.location.search), ...properties }
    : properties;
  window.dispatchEvent(new CustomEvent("fieldio:analytics", { detail: { name, properties: eventProperties } }));
  if (consented) track(name, eventProperties);
}
