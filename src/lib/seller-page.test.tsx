import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { availableStock, ContactDetailsForm, listingValuesFor, LiveInventoryEditor, sellerAttentionCounts, sellerPayoutTotals, SellerFulfillments, SellerOperations, SellerPage, VerificationForm, withInventorySnapshots, type SellerPayout } from "../pages/SellerPage";

const authenticatedPost = vi.hoisted(() => vi.fn(async () => ({ fulfillment: { status: "processing" } })));

vi.mock("../hooks/useSession", () => ({ useSession: () => ({ session: null, loading: false }) }));
vi.mock("../hooks/usePageMeta", () => ({ usePageMeta: () => undefined }));
vi.mock("../context/LocaleContext", () => ({ useLocale: () => ({ region: { currency: "GBP" } }) }));
vi.mock("./supabase", () => ({ supabase: null }));
vi.mock("./authenticated-api", () => ({ authenticatedPost }));

afterEach(cleanup);

const stockListing = {
  id: "own-listing", title: "Wool coat", status: "approved" as const,
  variants: [
    { id: "matrix-small", color: "Black", size: "S", quantity: 8, published_variant_id: "own-small" },
    { id: "matrix-large", color: "Black", size: "L", quantity: 3, published_variant_id: "own-large" }
  ]
};

it("separates payout states and currencies, including held payout lines", () => {
  const base = { reference: null, note: null, created_at: "2026-09-24T08:00:00Z", paid_at: null, items: [] };
  const payouts: SellerPayout[] = [
    { ...base, id: "pending-gbp", amount: 20000, currency: "GBP", status: "pending", items: [{ fulfillment_id: "fulfilment-a", amount: 5000, status: "held" }] },
    { ...base, id: "approved-usd", amount: 18000, currency: "USD", status: "approved" },
    { ...base, id: "held-gbp", amount: 3000, currency: "GBP", status: "held" },
    { ...base, id: "paid-gbp", amount: 8000, currency: "GBP", status: "paid", reference: "PAYOUT-123", paid_at: "2026-09-25T08:00:00Z" }
  ];
  const totals = sellerPayoutTotals(payouts);
  expect(totals.get("pending")?.get("GBP")).toBe(20000);
  expect(totals.get("approved")?.get("USD")).toBe(18000);
  expect(totals.get("held")?.get("GBP")).toBe(8000);
  expect(totals.get("paid")?.get("GBP")).toBe(8000);
  expect(totals.get("pending")?.get("USD")).toBeUndefined();
  render(<SellerOperations payouts={payouts} adjustments={[{ id: 1, payout_id: "paid-gbp", fulfillment_id: "fulfilment-a", kind: "refund", amount: 2000, currency: "GBP", reason: "Approved return", created_at: "2026-09-26T08:00:00Z" }]} fulfillments={[]} returns={[]} disputes={[]} />);
  expect(screen.getByText(/Payout reference/)).toBeDefined();
  expect(screen.getByText(/Approved return/)).toBeVisible();
  expect(screen.getByText(/Order fulfilment/)).toBeVisible();
  expect(screen.getAllByText(/\$180\.00/).length).toBeGreaterThan(0);
});

it("shows actionable orders only after payment confirmation and counts other real attention items", () => {
  const listings = [stockListing, { status: "rejected" as const, variants: [] }];
  const stock = withInventorySnapshots([stockListing as Parameters<typeof withInventorySnapshots>[0][number]], [
    { variant_id: "own-small", quantity: 8, reserved_quantity: 2, low_stock_threshold: 2 },
    { variant_id: "own-large", quantity: 3, reserved_quantity: 3, low_stock_threshold: 2 }
  ]);
  const counts = sellerAttentionCounts([stock[0]!, listings[1]!], [
    { status: "confirmed", payment_status: "pending" },
    { status: "confirmed", payment_status: "confirmed" },
    { status: "accepted", payment_status: "confirmed" },
    { status: "processing", payment_status: "confirmed" },
    { status: "delivered", payment_status: "confirmed" }
  ], 2, 3);
  expect(counts).toEqual({ response: 1, prepare: 1, ship: 1, lowStock: 1, rejected: 1, cases: 3, payouts: 2 });
});

it("uses only matching published inventory snapshots and calculates no, partial, and full reservations", () => {
  const [listing] = withInventorySnapshots([stockListing as Parameters<typeof withInventorySnapshots>[0][number]], [
    { variant_id: "own-small", quantity: 8, reserved_quantity: 0, low_stock_threshold: 2 },
    { variant_id: "own-large", quantity: 3, reserved_quantity: 3, low_stock_threshold: 2 },
    { variant_id: "another-store", quantity: 100, reserved_quantity: 100, low_stock_threshold: 2 }
  ]);
  expect(listing!.variants.map(({ quantity, reserved_quantity }) => [quantity, reserved_quantity])).toEqual([[8, 0], [3, 3]]);
  expect(availableStock(8, 0)).toBe(8);
  expect(availableStock(8, 2)).toBe(6);
  expect(availableStock(3, 3)).toBe(0);
  expect(sellerAttentionCounts([listing!], [], 0, 0).lowStock).toBe(1);
});

it("keeps reserved and available inventory read-only and rejects stock below reserved", async () => {
  const [listing] = withInventorySnapshots([stockListing as Parameters<typeof withInventorySnapshots>[0][number]], [
    { variant_id: "own-small", quantity: 8, reserved_quantity: 2, low_stock_threshold: 2 },
    { variant_id: "own-large", quantity: 3, reserved_quantity: 3, low_stock_threshold: 2 }
  ]);
  const onDone = vi.fn(async () => undefined);
  render(<LiveInventoryEditor listing={listing!} onCancel={() => undefined} onDone={onDone} />);
  const small = screen.getByRole("spinbutton", { name: /Stock on hand for Black, S/ });
  const large = screen.getByRole("spinbutton", { name: /Stock on hand for Black, L/ });
  expect(small).toHaveAttribute("min", "2");
  expect(large).toHaveAttribute("min", "3");
  expect(screen.getByLabelText("Available stock for Black, S")).toHaveTextContent("6");
  expect(screen.getByLabelText("Available stock for Black, L")).toHaveTextContent("0");
  expect(screen.queryByRole("spinbutton", { name: /Reserved/ })).not.toBeInTheDocument();
  fireEvent.change(large, { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Save inventory" }));
  expect(large).toBeInvalid();
  expect(screen.getByText("On-hand stock cannot be below reserved stock.")).toBeVisible();
  expect(onDone).not.toHaveBeenCalled();
});

it("requires an account before a seller can apply", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter><QueryClientProvider client={client}><SellerPage /></QueryClientProvider></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "Sell with Fieldio" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Create seller account" })).toHaveAttribute("href", "/account?mode=signup&returnTo=%2Fsell");
  expect(screen.getByText(/Every seller and vendor is verified/)).toBeVisible();
});

it("associates the seller declaration error with its checkbox", async () => {
  render(<VerificationForm userId="seller-1" email="seller@example.com" application={null} defaultCountryCode="GB" onDone={async () => undefined} />);
  fireEvent.click(screen.getByRole("button", { name: "Submit for verification" }));
  const declaration = screen.getByRole("checkbox", { name: /I confirm these details/ });
  await waitFor(() => expect(declaration).toHaveAttribute("aria-describedby", "seller-declaration-error"));
  expect(screen.getByText("Accept the verification declaration.")).toHaveAttribute("id", "seller-declaration-error");
});

it("lets an approved seller edit separate call and WhatsApp details", () => {
  const application = {
    id: "application", kind: "vendor" as const, legal_name: "Ada Vendor", business_name: "Ada Studio", country_code: "NG",
    phone_country_code: "NG", phone: "+2348012345678", whatsapp_country_code: "US", whatsapp_phone: "+12025550123",
    contact_email: "hello@example.com", website: null, identity_document_path: "id", address_document_path: "address", business_document_path: "business",
    status: "approved" as const, review_reason: null
  };
  const store = {
    id: "store", name: "Ada Studio", slug: "ada-studio", description: "Independent fashion seller.", contact_email: "store@example.com",
    logo_path: null, updated_at: "2026-09-22T00:00:00Z",
    contact_phone_country_code: "NG", contact_phone: "+2348012345678", contact_whatsapp_country_code: "US", contact_whatsapp_phone: "+12025550123",
    status: "active" as const
  };
  render(<ContactDetailsForm application={application} store={store} onCancel={() => undefined} onDone={async () => undefined} />);
  expect(screen.getByRole("combobox", { name: "Calling code" })).toHaveValue("NG");
  expect(screen.getByRole("textbox", { name: "Phone calls" })).toHaveValue("8012345678");
  expect(screen.getByRole("combobox", { name: "WhatsApp country code" })).toHaveValue("US");
  expect(screen.getByRole("textbox", { name: "WhatsApp number" })).toHaveValue("2025550123");
  expect(screen.getByRole("button", { name: "Save contact details" })).toBeVisible();
});

it("converts stored listing amounts and options back into editable form values", () => {
  const values = listingValuesFor({
    id: "listing", title: "Wool coat", description: "A carefully kept wool coat in excellent condition.", audience: "women",
    category_id: "11111111-1111-4111-8111-111111111111", subcategory_id: "22222222-2222-4222-8222-222222222222",
    condition: "excellent", condition_notes: "No visible defects.", materials: "100% wool", item_reference: null,
    price: 125000, compare_at_price: 150000, currency: "GBP", colors: ["Black", "Cream"], sizes: ["S", "M"],
    quantity: 2, weight_kg: 1.4, authenticity_confirmed: true, status: "rejected", is_paused: false, review_reason: "Replace one image.",
    published_product_id: null, created_at: "2026-09-20T00:00:00Z", images: [], variants: [
      { id: "33333333-3333-4333-8333-333333333333", color: "Black", size: "S", quantity: 2 },
      { id: "44444444-4444-4444-8444-444444444444", color: "Cream", size: "M", quantity: 1 }
    ]
  }, "USD");

  expect(values).toMatchObject({ price: 1250, compare_at_price: 1500, currency: "GBP", variants: [{ color: "Black", size: "S", quantity: 2 }, { color: "Cream", size: "M", quantity: 1 }] });
});

it("requires a vendor to accept a confirmed fulfillment before preparing it", async () => {
  const refreshed = vi.fn(async () => undefined);
  render(<SellerFulfillments fulfillments={[{
    id: "11111111-1111-4111-8111-111111111111", order_request_id: "22222222-2222-4222-8222-222222222222", public_reference: "FLD-202609-01004",
    status: "confirmed", payment_status: "confirmed", store_name: "Ada Studio", customer_name: null, customer_phone: null, shipping_address: null,
    carrier: null, tracking_reference: null, rejection_reason: null, accepted_at: null, rejected_at: null, preparing_at: null, shipped_at: null, delivered_at: null, created_at: "2026-09-24T08:00:00Z", updated_at: "2026-09-24T08:00:00Z",
    items: [{ id: "33333333-3333-4333-8333-333333333333", productName: "Tailored coat", variantName: "Medium", size: "M", color: "Black", quantity: 1, sku: "COAT-M" }]
  }]} onUpdated={refreshed} />);
  expect(screen.getByRole("heading", { name: "Orders to fulfil" })).toBeVisible();
  expect(screen.getByText("Tailored coat · Medium · M · Black")).toBeVisible();
  expect(screen.queryByText("Buyer Name")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Accept order" }));
  await waitFor(() => expect(authenticatedPost).toHaveBeenCalledWith("/api/vendor-fulfillment", { action: "update-fulfillment", fulfillmentId: "11111111-1111-4111-8111-111111111111", status: "accepted" }));
  expect(refreshed).toHaveBeenCalledOnce();
});

it("requires a reason when a vendor rejects a fulfillment", async () => {
  authenticatedPost.mockClear();
  render(<SellerFulfillments fulfillments={[{
    id: "11111111-1111-4111-8111-111111111111", order_request_id: "22222222-2222-4222-8222-222222222222", public_reference: "FLD-202609-01004",
    status: "confirmed", payment_status: "confirmed", store_name: "Ada Studio", customer_name: null, customer_phone: null, shipping_address: null,
    carrier: null, tracking_reference: null, rejection_reason: null, accepted_at: null, rejected_at: null, preparing_at: null, shipped_at: null, delivered_at: null, created_at: "2026-09-24T08:00:00Z", updated_at: "2026-09-24T08:00:00Z",
    items: [{ id: "33333333-3333-4333-8333-333333333333", productName: "Tailored coat", variantName: "Medium", size: "M", color: "Black", quantity: 1, sku: "COAT-M" }]
  }]} onUpdated={async () => undefined} />);

  fireEvent.click(screen.getByRole("button", { name: "Reject order" }));
  const reason = screen.getByRole("textbox", { name: "Reason for rejection" });
  await waitFor(() => expect(reason).toHaveFocus());
  fireEvent.change(reason, { target: { value: "The item failed our final stock check." } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm rejection" }));
  await waitFor(() => expect(authenticatedPost).toHaveBeenCalledWith("/api/vendor-fulfillment", {
    action: "update-fulfillment", fulfillmentId: "11111111-1111-4111-8111-111111111111", status: "rejected", rejectionReason: "The item failed our final stock check."
  }));
});

it("lets an accepted fulfillment move into preparation", async () => {
  authenticatedPost.mockClear();
  render(<SellerFulfillments fulfillments={[{
    id: "11111111-1111-4111-8111-111111111111", order_request_id: "22222222-2222-4222-8222-222222222222", public_reference: "FLD-202609-01004",
    status: "accepted", payment_status: "confirmed", store_name: "Ada Studio", customer_name: "Buyer Name", customer_phone: "+447000000000", shipping_address: "10 London Road, London",
    carrier: null, tracking_reference: null, rejection_reason: null, accepted_at: "2026-09-24T08:05:00Z", rejected_at: null, preparing_at: null, shipped_at: null, delivered_at: null, created_at: "2026-09-24T08:00:00Z", updated_at: "2026-09-24T08:05:00Z",
    items: [{ id: "33333333-3333-4333-8333-333333333333", productName: "Tailored coat", variantName: "Medium", size: "M", color: "Black", quantity: 1, sku: "COAT-M" }]
  }]} onUpdated={async () => undefined} />);

  fireEvent.click(screen.getByRole("button", { name: "Start preparing" }));
  await waitFor(() => expect(authenticatedPost).toHaveBeenCalledWith("/api/vendor-fulfillment", { action: "update-fulfillment", fulfillmentId: "11111111-1111-4111-8111-111111111111", status: "processing" }));
});

it("requires and submits shipping details before a vendor marks an order shipped", async () => {
  authenticatedPost.mockClear();
  const refreshed = vi.fn(async () => undefined);
  render(<SellerFulfillments fulfillments={[{
    id: "11111111-1111-4111-8111-111111111111", order_request_id: "22222222-2222-4222-8222-222222222222", public_reference: "FLD-202609-01004",
    status: "processing", payment_status: "confirmed", store_name: "Ada Studio", customer_name: "Buyer Name", customer_phone: "+447000000000", shipping_address: "10 London Road, London",
    carrier: null, tracking_reference: null, rejection_reason: null, accepted_at: "2026-09-24T08:05:00Z", rejected_at: null, preparing_at: "2026-09-24T08:10:00Z", shipped_at: null, delivered_at: null, created_at: "2026-09-24T08:00:00Z", updated_at: "2026-09-24T08:10:00Z",
    items: [{ id: "33333333-3333-4333-8333-333333333333", productName: "Tailored coat", variantName: "Medium", size: "M", color: "Black", quantity: 1, sku: "COAT-M" }]
  }]} onUpdated={refreshed} />);

  const trigger = screen.getByRole("button", { name: "Add shipping details" });
  fireEvent.click(trigger);
  let carrier = screen.getByRole("textbox", { name: "Logistics company" });
  await waitFor(() => expect(carrier).toHaveFocus());
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(trigger).toHaveFocus());
  fireEvent.click(trigger);
  carrier = screen.getByRole("textbox", { name: "Logistics company" });
  const tracking = screen.getByRole("textbox", { name: "Tracking or itinerary reference" });
  expect(carrier).toBeRequired();
  expect(tracking).toBeRequired();
  fireEvent.change(carrier, { target: { value: "DHL Express" } });
  fireEvent.change(tracking, { target: { value: "DHL-123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Submit shipment" }));

  await waitFor(() => expect(authenticatedPost).toHaveBeenCalledWith("/api/vendor-fulfillment", {
    action: "update-fulfillment", fulfillmentId: "11111111-1111-4111-8111-111111111111", status: "shipped",
    carrier: "DHL Express", trackingReference: "DHL-123456"
  }));
  expect(refreshed).toHaveBeenCalledOnce();
});
