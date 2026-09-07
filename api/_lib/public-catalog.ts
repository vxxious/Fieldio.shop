import { createClient } from "@supabase/supabase-js";

export const publicPages: Record<string, [string, string]> = {
  "/": ["Fieldio | Everything fashion", "Luxury sourcing, personal shopping, and worldwide shipment for women, men, and accessories."],
  "/collections": ["Collections | Fieldio", "Explore the Fieldio fashion edit and request your next piece."],
  "/collections/new-arrivals": ["New arrivals | Fieldio", "Discover the latest pieces selected by Fieldio."],
  "/collections/luxury": ["Luxury sourcing | Fieldio", "Request luxury pieces through Fieldio personal shopping."],
  "/collections/women": ["Women | Fieldio", "Explore womenswear through Fieldio personal shopping."],
  "/collections/men": ["Men | Fieldio", "Explore menswear through Fieldio personal shopping."],
  "/collections/bags": ["Bags | Fieldio", "Discover bags and accessories through Fieldio."],
  "/collections/shoes": ["Shoes | Fieldio", "Find footwear through Fieldio personal shopping."],
  "/brands": ["Brands | Fieldio", "Explore brands available through the Fieldio sourcing service."],
  "/about": ["About Fieldio", "Everything fashion. Worldwide shipment. Meet Fieldio."],
  "/personal-shopping": ["Personal shopping | Fieldio", "Your personal shopper for luxury brands, with worldwide delivery."],
  "/wholesale": ["Wholesale | Fieldio", "Contact Fieldio about wholesale fashion and supply services."],
  "/contact": ["Contact Fieldio", "Get in touch with Fieldio for sourcing, orders, and wholesale enquiries."],
  "/shipping": ["Shipping | Fieldio", "How shipping is confirmed for Fieldio order requests."],
  "/returns": ["Returns | Fieldio", "Return terms are confirmed before purchase."],
  "/privacy": ["Privacy | Fieldio", "How Fieldio handles personal information."],
  "/terms": ["Terms | Fieldio", "Fieldio shopping and sourcing terms."],
  "/cookies": ["Cookies | Fieldio", "Storage and privacy preferences for Fieldio."]
};

export function publicClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}
export function siteOrigin() { return new URL(process.env.APP_URL || "https://fieldio.shop").origin; }
export function escapeMarkup(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!); }
