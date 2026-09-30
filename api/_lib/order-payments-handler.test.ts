import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  requireStaff: vi.fn(),
  sendTrackedEmail: vi.fn()
}));

vi.mock("./admin.js", () => ({ requireStaff: mocks.requireStaff }));
vi.mock("./email.js", () => ({ sendTrackedEmail: mocks.sendTrackedEmail }));
vi.mock("./server.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("./server.js")>(),
  checkRateLimit: vi.fn(async () => true)
}));

import { POST } from "./order-payments-handler.js";

const orderId = "11111111-1111-4111-8111-111111111111";

describe("manual order payment confirmation", () => {
  beforeEach(() => {
    mocks.rpc.mockReset().mockResolvedValue({ data: { id: orderId, public_reference: "FLD-1001", customer_email: "buyer@example.com", currency: "GBP", payment_amount: 12500, payment_method: "bank_transfer", payment_reference: "BANK-123" }, error: null });
    mocks.requireStaff.mockReset().mockResolvedValue({ admin: {}, client: { rpc: mocks.rpc } });
    mocks.sendTrackedEmail.mockReset().mockResolvedValue("sent");
  });

  it("records minor-unit amounts through the guarded RPC and notifies the buyer", async () => {
    const response = await POST(new Request("https://fieldio.shop/api/admin/order-payments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId, amount: 12500, shippingAmount: 500, method: "bank_transfer", reference: "BANK-123" })
    }));

    expect(response.status).toBe(200);
    expect(mocks.requireStaff).toHaveBeenCalledWith(expect.any(Request), ["owner", "admin"]);
    expect(mocks.rpc).toHaveBeenCalledWith("confirm_order_payment", { p_order_id: orderId, p_amount: 12500, p_shipping_total: 500, p_method: "bank_transfer", p_reference: "BANK-123" });
    expect(mocks.sendTrackedEmail).toHaveBeenCalledWith(expect.anything(), `order:${orderId}:payment-confirmed`, "order-payment-confirmed", expect.objectContaining({ to: "buyer@example.com" }));
  });

  it("rejects an invalid amount before calling the database", async () => {
    const response = await POST(new Request("https://fieldio.shop/api/admin/order-payments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId, amount: 0, shippingAmount: 0, method: "bank_transfer", reference: "BANK-123" })
    }));

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
