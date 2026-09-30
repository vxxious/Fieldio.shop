import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AdminOrders } from "../components/admin/AdminOrders";

const authenticatedPost = vi.hoisted(() => vi.fn(async () => ({ emailDelivered: true })));
const rows = vi.hoisted(() => ({
  order_requests: [{ id: "11111111-1111-4111-8111-111111111111", public_reference: "FLD-1001", customer_name: "Ada Buyer", customer_email: "ada@example.com", customer_phone: "+44 7000", shipping_address: "1 Fieldio Street", status: "order_request", fulfillment_status: "awaiting_vendor", payment_status: "pending", payment_amount: null, payment_method: null, payment_reference: null, payment_confirmed_at: null, subtotal: 10000, shipping_total: 0, total: 10000, currency: "GBP", created_at: "2026-09-28T10:00:00Z", updated_at: "2026-09-28T10:00:00Z" }],
  order_items: [{ id: "item-1", fulfillment_id: "group-1", product_name: "Silk shirt", variant_name: null, size: "M", color: "Black", quantity: 1, unit_price: 10000, line_total: 10000 }],
  order_fulfillments: [{ id: "group-1", store_name: "Gucci", status: "pending", carrier: null, tracking_reference: null, rejection_reason: null, accepted_at: null, preparing_at: null, shipped_at: null, delivered_at: null, rejected_at: null, gross_amount: 10000, commission_amount: 1000, vendor_net_amount: 9000, payout_status: "pending", payout_hold_status: "clear", payout_adjustment_amount: 0, updated_at: "2026-09-28T10:00:00Z" }],
  marketplace_returns: [], marketplace_disputes: [],
  order_events: [{ id: 1, event_type: "order_created", store_name: null, from_status: null, to_status: "order_request", carrier: null, tracking_reference: null, note: null, created_at: "2026-09-28T10:00:00Z" }]
}));

vi.mock("./authenticated-api", () => ({ authenticatedPost }));
vi.mock("./supabase", () => {
  class Query implements PromiseLike<{ data: unknown[]; error: null }> {
    constructor(private data: unknown[]) {}
    select() { return this; }
    order() { return this; }
    limit() { return this; }
    eq() { return this; }
    then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(onfulfilled?: ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null) { return Promise.resolve({ data: this.data, error: null }).then(onfulfilled, onrejected); }
  }
  return { supabase: { from: (table: keyof typeof rows) => new Query(rows[table]) } };
});

it("shows one operational order record and uses the guarded status endpoint", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><AdminOrders role="admin" /></QueryClientProvider>);
  expect(await screen.findByRole("heading", { name: "Ada Buyer" })).toBeInTheDocument();
  expect(await screen.findByText("Gucci")).toBeInTheDocument();
  expect(screen.getByText(/Silk shirt/)).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Immutable timeline" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Update order" }));
  await waitFor(() => expect(authenticatedPost).toHaveBeenCalledWith("/api/order-status", { orderId: "11111111-1111-4111-8111-111111111111", status: "awaiting_confirmation" }));
});
