import type { Currency } from "../types/catalog";

export function formatPrice(value: number | null, currency: Currency): string {
  if (value === null) return "Price on request";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value / 100);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}
