import type { Product } from "../types/catalog";

const conditionLabels: Record<string, string> = {
  new_with_tags: "New with tags",
  new_without_tags: "New without tags",
  excellent: "Excellent",
  very_good: "Very Good",
  good: "Good",
  fair: "Fair"
};

const europeanRegions = new Set(["AT", "BE", "CH", "DE", "DK", "ES", "FI", "FR", "GR", "IE", "IT", "LU", "NL", "NO", "PL", "PT", "SE"]);

export function productCondition(product: Product): string {
  const condition = product.condition ?? product.tags.find((tag) => tag in conditionLabels);
  return condition ? conditionLabels[condition] ?? condition.replaceAll("_", " ") : "Confirmed before payment";
}

export function productSizeSummary(product: Product, limit = 3): string {
  const sizes = [...new Set(product.variants.flatMap((variant) => variant.size ? [variant.size] : []))];
  if (!sizes.length) return "Size confirmed on request";
  const visible = sizes.slice(0, limit).join(", ");
  return sizes.length > limit ? `${visible} +${sizes.length - limit}` : visible;
}

export function deliveryGuidance(regionCode: string) {
  if (regionCode === "GB") return {
    estimate: "Typical courier window after dispatch: 2–5 working days.",
    duties: "UK duties are not normally expected for UK-dispatched items; sourcing origin is confirmed before payment."
  };
  if (europeanRegions.has(regionCode)) return {
    estimate: "Typical courier window after dispatch: 4–8 working days.",
    duties: "Import duties or taxes may apply depending on the sourcing origin and destination."
  };
  return {
    estimate: "Typical courier window after dispatch: 5–12 working days.",
    duties: "Import duties or taxes may apply and are confirmed where known before payment."
  };
}

export const returnEligibility = "Eligibility is confirmed before payment. Sourced, personalised, final-sale, and hygiene-sensitive items may be excluded.";
