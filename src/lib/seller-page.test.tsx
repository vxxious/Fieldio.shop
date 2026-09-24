import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { ContactDetailsForm, listingValuesFor, SellerFulfillments, SellerPage } from "../pages/SellerPage";

const authenticatedPost = vi.hoisted(() => vi.fn(async () => ({ fulfillment: { status: "processing" } })));

vi.mock("../hooks/useSession", () => ({ useSession: () => ({ session: null, loading: false }) }));
vi.mock("../hooks/usePageMeta", () => ({ usePageMeta: () => undefined }));
vi.mock("../context/LocaleContext", () => ({ useLocale: () => ({ region: { currency: "GBP" } }) }));
vi.mock("./supabase", () => ({ supabase: null }));
vi.mock("./authenticated-api", () => ({ authenticatedPost }));

it("requires an account before a seller can apply", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter><QueryClientProvider client={client}><SellerPage /></QueryClientProvider></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "Sell with Fieldio" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Create seller account" })).toHaveAttribute("href", "/account?mode=signup&returnTo=%2Fsell");
  expect(screen.getByText(/Every seller and vendor is verified/)).toBeVisible();
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
    quantity: 2, weight_kg: 1.4, authenticity_confirmed: true, status: "rejected", review_reason: "Replace one image.",
    published_product_id: null, created_at: "2026-09-20T00:00:00Z", images: []
  }, "USD");

  expect(values).toMatchObject({ price: 1250, compare_at_price: 1500, currency: "GBP", colors: "Black, Cream", sizes: "S, M", quantity: 2 });
});

it("shows only the vendor fulfillment and sends guarded status updates", async () => {
  const refreshed = vi.fn(async () => undefined);
  render(<SellerFulfillments fulfillments={[{
    id: "11111111-1111-4111-8111-111111111111", order_request_id: "22222222-2222-4222-8222-222222222222", public_reference: "FLD-202609-01004",
    status: "confirmed", store_name: "Ada Studio", customer_name: "Buyer Name", customer_phone: "+447000000000", shipping_address: "10 London Road, London",
    carrier: null, tracking_reference: null, created_at: "2026-09-24T08:00:00Z", updated_at: "2026-09-24T08:00:00Z",
    items: [{ id: "33333333-3333-4333-8333-333333333333", productName: "Tailored coat", variantName: "Medium", size: "M", color: "Black", quantity: 1, sku: "COAT-M" }]
  }]} onUpdated={refreshed} />);
  expect(screen.getByRole("heading", { name: "Orders to fulfil" })).toBeVisible();
  expect(screen.getByText("Tailored coat · Medium · M · Black")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Start preparing" }));
  await waitFor(() => expect(authenticatedPost).toHaveBeenCalledWith("/api/vendor-fulfillment", { fulfillmentId: "11111111-1111-4111-8111-111111111111", status: "processing" }));
  expect(refreshed).toHaveBeenCalledOnce();
});
