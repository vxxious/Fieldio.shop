import type { CartItem, CustomerDetails } from "../types/catalog";
import { formatPrice } from "./format";

export const FIELDIO_WHATSAPP_NUMBER = "447344059705";

export function buildWhatsAppOrderMessage(customer: CustomerDetails, items: CartItem[]): string {
  const pricedItems = items.filter((item) => item.unitPrice !== null);
  const currencies = new Set(pricedItems.map((item) => item.currency));
  const canTotal = pricedItems.length === items.length && currencies.size === 1;
  const subtotal = canTotal
    ? formatPrice(pricedItems.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.quantity, 0), pricedItems[0]?.currency ?? "GBP")
    : "To be confirmed";

  const itemLines = items.map((item, index) => [
    `${index + 1}. ${item.productName}`,
    `Brand: ${item.brand}`,
    `SKU: ${item.sku}`,
    `Size/variant: ${[item.selectedSize, item.selectedVariant].filter(Boolean).join(" · ")}`,
    `Quantity: ${item.quantity}`,
    `Price: ${formatPrice(item.unitPrice, item.currency)}`
  ].join("\n"));

  return [
    "Fieldio Order Request",
    "",
    "Customer:",
    customer.name,
    `Phone: ${customer.phone}`,
    `Email: ${customer.email}`,
    `Shipping address: ${customer.shippingAddress}`,
    "",
    "Items:",
    itemLines.join("\n\n"),
    "",
    `Order subtotal: ${subtotal}`,
    "Shipping: To be confirmed",
    `Total: ${subtotal}`,
    customer.note ? `\nNote: ${customer.note}` : "",
    "",
    "Please confirm availability, shipping, and payment details. I understand this is an order request and is not yet confirmed or paid."
  ].filter(Boolean).join("\n");
}

export function createWhatsAppUrl(message: string): string {
  return `https://wa.me/${FIELDIO_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function createProductEnquiryUrl(name: string, sku: string, url: string): string {
  return createWhatsAppUrl(`Hello Fieldio, I would like to enquire about:\n\n${name}\nSKU: ${sku}\n${url}`);
}
