import { describe, expect, it } from "vitest";
import { orderStatusCopy } from "../../api/order-status.js";

describe("order status notifications", () => {
  it("defines customer copy for every post-request status", () => {
    expect(Object.keys(orderStatusCopy)).toEqual(["awaiting_confirmation", "confirmed", "processing", "shipped", "delivered", "cancelled"]);
    expect(orderStatusCopy.awaiting_confirmation.message).toContain("No payment has been taken");
    expect(orderStatusCopy.shipped.message).toContain("tracking");
  });
});
