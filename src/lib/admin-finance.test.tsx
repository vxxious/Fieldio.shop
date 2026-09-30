import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AdminFinance } from "../components/admin/AdminFinance";

const authenticatedPost = vi.hoisted(() => vi.fn(async () => ({ emailDelivered: true })));
vi.mock("./authenticated-api", () => ({ authenticatedPost }));
vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => table === "order_requests" ? {
        eq: () => ({ in: () => ({ order: () => ({ limit: async () => ({ data: [{ id: "11111111-1111-4111-8111-111111111111", public_reference: "FLD-1001", customer_name: "Ada", status: "confirmed", currency: "GBP", subtotal: 12000 }], error: null }) }) }) })
      } : table === "order_fulfillments" ? {
        eq: () => ({ eq: () => ({ not: async () => ({ data: [], error: null }) }) })
      } : {
        order: () => ({ limit: async () => ({ data: [], error: null }) })
      }
    })
  }
}));

it("submits exact minor-unit payment amounts", async () => {
  authenticatedPost.mockClear();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><AdminFinance /></QueryClientProvider>);

  fireEvent.change(await screen.findByLabelText("Amount received (GBP)"), { target: { value: "125.50" } });
  fireEvent.change(screen.getByLabelText("Shipping included (GBP)"), { target: { value: "5.00" } });
  fireEvent.change(screen.getByLabelText("Payment reference"), { target: { value: "BANK-123" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm payment" }));

  await waitFor(() => expect(authenticatedPost).toHaveBeenCalledWith("/api/admin/order-payments", {
    orderId: "11111111-1111-4111-8111-111111111111",
    amount: 12550,
    shippingAmount: 500,
    method: "bank_transfer",
    reference: "BANK-123"
  }));
});
