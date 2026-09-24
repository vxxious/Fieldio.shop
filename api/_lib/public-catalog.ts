import { createClient } from "@supabase/supabase-js";

export const publicPages: Record<string, [string, string]> = {
  "/": ["Fieldio Shop | Designer Fashion & Personal Shopping", "Fieldio is an independent designer fashion marketplace and personal shopping service for clothing, footwear, and accessories, with worldwide sourcing and delivery support."],
  "/collections": ["Designer Fashion Collections | Fieldio", "Explore Fieldio's curated edit of designer clothing, footwear, and accessories for women and men."],
  "/collections/new-arrivals": ["New Designer Fashion Arrivals | Fieldio", "Discover the latest designer fashion selected by Fieldio, with personal sourcing and worldwide delivery support."],
  "/collections/luxury": ["Luxury Fashion Sourcing | Fieldio", "Request luxury clothing, footwear, and accessories through Fieldio personal shopping and worldwide delivery support."],
  "/collections/women": ["Designer Womenswear | Fieldio", "Explore designer womenswear selected and personally sourced by Fieldio, with worldwide delivery support."],
  "/collections/men": ["Designer Menswear | Fieldio", "Explore designer menswear selected and personally sourced by Fieldio, with worldwide delivery support."],
  "/brands": ["Designer Brands | Fieldio", "Explore designer brands available through Fieldio's personal fashion sourcing service."],
  "/about": ["About Fieldio | Designer Fashion Marketplace", "Fieldio is an independent designer fashion marketplace and personal shopping service operating at fieldio.shop."],
  "/promise": ["The Fieldio Promise | Seller & Product Standards", "Learn how Fieldio reviews sellers and listings, describes condition, and confirms sourcing, delivery, and support."],
  "/how-it-works": ["How Fieldio Works | Fashion Requests & Sourcing", "See how to browse, request, confirm, pay for, and follow a fashion order through Fieldio."],
  "/personal-shopping": ["Luxury Personal Shopping | Fieldio", "Ask Fieldio to source a specific designer piece, confirm availability, and coordinate worldwide delivery."],
  "/wholesale": ["Fashion Wholesale Enquiries | Fieldio", "Contact Fieldio about designer fashion supply, boutique sourcing, and wholesale enquiries."],
  "/sell": ["Sell Fashion with Fieldio", "Apply as a verified seller or vendor, create your Fieldio store, and submit authentic fashion for review."],
  "/contact": ["Contact Fieldio | Fashion Sourcing Support", "Contact Fieldio for designer product sourcing, order requests, worldwide shipping, and wholesale enquiries."],
  "/shipping": ["Shipping | Fieldio", "How shipping is confirmed for Fieldio order requests."],
  "/returns": ["Returns | Fieldio", "Return terms are confirmed before purchase."],
  "/privacy": ["Privacy | Fieldio", "How Fieldio handles personal information."],
  "/terms": ["Terms | Fieldio", "Fieldio shopping and sourcing terms."],
  "/cookies": ["Cookies | Fieldio", "Storage and privacy preferences for Fieldio."]
};

export function publicClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}
export function siteOrigin() { return new URL(process.env.APP_URL || "https://fieldio.shop").origin; }
export function escapeMarkup(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!); }
