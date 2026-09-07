import { describe, expect, it } from "vitest";
import type { CartItem, CustomerDetails } from "../types/catalog";
import { buildWhatsAppOrderMessage, createWhatsAppUrl } from "./whatsapp";

const customer: CustomerDetails = { name: "Ada Example", phone: "+44 7000 000000", email: "ada@example.com", shippingAddress: "10 Example Street, London, United Kingdom" };
const item: CartItem = { key: "p:v", productId: "p", sku: "SKU-1", productName: "Column Dress", brand: "Fieldio Edit", image: "/dress.png", selectedSize: "M", selectedVariant: "Black / M", variantId: "v", quantity: 2, unitPrice: 15000, currency: "GBP" };

describe("WhatsApp checkout", () => {
  it("formats a structured order request with a trusted total", () => {
    const message = buildWhatsAppOrderMessage(customer, [item]);
    expect(message).toContain("Fieldio Order Request");
    expect(message).toContain("Size/variant: M · Black / M");
    expect(message).toContain("Order subtotal: £300.00");
    expect(message).toContain("not yet confirmed or paid");
  });

  it("does not invent a total for price-on-request items", () => {
    const message = buildWhatsAppOrderMessage(customer, [{ ...item, unitPrice: null }]);
    expect(message).toContain("Order subtotal: To be confirmed");
    expect(message).toContain("Price: Price on request");
  });

  it("uses the international WhatsApp number", () => {
    expect(createWhatsAppUrl("Hello")).toBe("https://wa.me/447344059705?text=Hello");
  });
});
