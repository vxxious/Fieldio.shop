import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccountDetails } from "../components/AccountDetails";

const account = vi.hoisted(() => ({ intent: null as "buy" | "sell" | null, avatar: null as string | null, orders: [] as Array<Record<string, unknown>>, fulfillments: [] as Array<Record<string, unknown>>, events: [] as Array<Record<string, unknown>>, update: vi.fn(), upload: vi.fn() }));
vi.mock("./authenticated-api", () => ({ authenticatedPost: vi.fn() }));

vi.mock("../context/LocaleContext", () => ({
  useLocale: () => ({ formatMoney: () => "£0", language: { locale: "en-GB" }, t: (key: string) => ({ "account.wantBuy": "I want to buy", "account.yourAccount": "Your account", "account.myRequests": "My order requests", "account.copyReference": "Copy reference", "account.referenceCopied": "Reference copied" })[key] ?? key })
}));

vi.mock("./supabase", () => ({
  supabase: {
    rpc: async (name: string) => ({ data: name === "buyer_order_fulfillments" ? account.fulfillments : name === "buyer_order_timeline" ? account.events : null, error: null }),
    from: (table: string) => ({
      select: () => table === "order_requests"
        ? { eq: () => ({ order: async () => ({ data: account.orders, error: null }) }) }
        : { eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }), maybeSingle: async () => ({ data: table === "profiles" ? { full_name: "Ada Example", phone: null, avatar_url: account.avatar, account_intent: account.intent } : null, error: null }) }) },
      update: (value: { account_intent?: "buy" | "sell"; avatar_url?: string }) => ({ eq: async () => { account.update(value); account.intent = value.account_intent ?? account.intent; account.avatar = value.avatar_url ?? account.avatar; return { error: null }; } }),
      upsert: async () => ({ error: null })
    }),
    storage: { from: () => ({ upload: account.upload, getPublicUrl: () => ({ data: { publicUrl: "https://project.supabase.co/storage/v1/object/public/profile-media/user-1/avatar" } }) }) },
    auth: {
      signOut: async () => ({ error: null }), resetPasswordForEmail: async () => ({ error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null }),
        listFactors: async () => ({ data: { all: [], totp: [] }, error: null }),
        enroll: vi.fn(), unenroll: vi.fn(), challengeAndVerify: vi.fn()
      }
    }
  }
}));

beforeEach(() => { account.intent = null; account.avatar = null; account.orders = []; account.fulfillments = []; account.events = []; account.update.mockClear(); account.upload.mockReset().mockResolvedValue({ error: null }); });
afterEach(cleanup);

it("asks a new account how it will use Fieldio and saves the choice", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter><QueryClientProvider client={client}><AccountDetails userId="user-1" email="ada@example.com" /></QueryClientProvider></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: /I want to buy/ }));
  await waitFor(() => expect(account.update).toHaveBeenCalledWith({ account_intent: "buy" }));
  expect(await screen.findByRole("heading", { name: "Ada Example" })).toBeVisible();
  expect(screen.getByRole("navigation", { name: "Your account" })).toBeVisible();
});

it("copies an order reference", async () => {
  account.intent = "buy";
  account.orders = [{ id: "order-1", public_reference: "FLD-123", status: "confirmed", created_at: "2026-09-18T00:00:00Z", updated_at: "2026-09-19T00:00:00Z", confirmed_at: "2026-09-19T00:00:00Z", subtotal: null, currency: "GBP", order_items: [] }];
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter><QueryClientProvider client={client}><AccountDetails userId="user-1" email="ada@example.com" /></QueryClientProvider></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "My order requests" }));
  fireEvent.click(await screen.findByRole("button", { name: "Copy reference" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("FLD-123"));
  expect(screen.getByRole("button", { name: "Reference copied" })).toBeVisible();
});

it("shows every completed stage for a delivered order", async () => {
  account.intent = "buy";
  account.orders = [{ id: "order-1", public_reference: "FLD-123", status: "delivered", created_at: "2026-09-18T00:00:00Z", updated_at: "2026-09-23T00:00:00Z", confirmed_at: "2026-09-19T00:00:00Z", subtotal: null, currency: "GBP", order_items: [] }];
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter><QueryClientProvider client={client}><AccountDetails userId="user-1" email="ada@example.com" /></QueryClientProvider></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "My order requests" }));
  const progress = await screen.findByRole("list", { name: "account.progress" });
  expect(progress.querySelectorAll("li.complete")).toHaveLength(5);
  expect(progress.querySelector('[aria-current="step"]')).toHaveTextContent("account.status.delivered");
  expect(progress.querySelectorAll("time")).toHaveLength(3);
});

it("shows a truthful partial status and each vendor fulfilment", async () => {
  account.intent = "buy";
  account.orders = [{ id: "order-1", public_reference: "FIELDIO-1001", status: "processing", fulfillment_status: "partially_fulfilled", created_at: "2026-09-18T00:00:00Z", updated_at: "2026-09-23T00:00:00Z", confirmed_at: "2026-09-19T00:00:00Z", subtotal: null, currency: "GBP", payment_status: "confirmed", payment_amount: 10000, payment_method: "bank_transfer", payment_reference: "PAY-1", order_items: [], marketplace_returns: [], marketplace_disputes: [] }];
  account.fulfillments = [
    { order_request_id: "order-1", store_name: "Gucci", status: "shipped", carrier: "DHL Express", tracking_reference: "DHL-123", accepted_at: "2026-09-20T00:00:00Z", preparing_at: "2026-09-21T00:00:00Z", shipped_at: "2026-09-23T00:00:00Z", delivered_at: null, rejected_at: null, updated_at: "2026-09-23T00:00:00Z", items: [{ id: "item-1", productName: "Gucci bag", quantity: 1 }] },
    { order_request_id: "order-1", store_name: "Nike", status: "processing", updated_at: "2026-09-22T00:00:00Z", items: [{ id: "item-2", productName: "Nike Air Force", quantity: 1 }] }
  ];
  account.events = [{ id: 1, order_request_id: "order-1", fulfillment_id: "group-1", event_type: "fulfillment_status_changed", store_name: "Gucci", from_status: "processing", to_status: "shipped", carrier: "DHL Express", tracking_reference: "DHL-123", occurred_at: "2026-09-23T00:00:00Z" }];
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter><QueryClientProvider client={client}><AccountDetails userId="user-1" email="ada@example.com" /></QueryClientProvider></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "My order requests" }));
  expect(await screen.findByText(/Partially fulfilled/)).toBeVisible();
  const groups = screen.getByRole("region", { name: "Fulfilment by store" });
  expect(groups).toHaveTextContent("Gucci");
  expect(groups).toHaveTextContent("Shipped");
  expect(groups).toHaveTextContent("Nike");
  expect(groups).toHaveTextContent("Preparing");
  expect(groups).toHaveTextContent("DHL Express");
  expect(groups).toHaveTextContent("DHL-123");
  expect(screen.getByRole("list", { name: "Gucci delivery progress" }).querySelectorAll("li.complete")).toHaveLength(3);
  expect(screen.getByRole("region", { name: "Order activity" })).toHaveTextContent("Gucci shipped your items");
});

it("keeps a delivered vendor visible when another vendor rejects", async () => {
  account.intent = "buy";
  account.orders = [{ id: "order-1", public_reference: "FIELDIO-1002", status: "delivered", fulfillment_status: "partially_delivered", created_at: "2026-09-18T00:00:00Z", updated_at: "2026-09-24T00:00:00Z", confirmed_at: "2026-09-19T00:00:00Z", subtotal: null, currency: "GBP", payment_status: "confirmed", payment_amount: 10000, payment_method: "bank_transfer", payment_reference: "PAY-2", order_items: [], marketplace_returns: [], marketplace_disputes: [] }];
  account.fulfillments = [
    { order_request_id: "order-1", store_name: "Gucci", status: "delivered", updated_at: "2026-09-24T00:00:00Z", items: [{ id: "item-1", productId: "product-1", productSlug: "gucci-bag", productName: "Gucci bag", quantity: 1, reviewId: null }] },
    { order_request_id: "order-1", store_name: "Nike", status: "rejected", updated_at: "2026-09-20T00:00:00Z", items: [] }
  ];
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter><QueryClientProvider client={client}><AccountDetails userId="user-1" email="ada@example.com" /></QueryClientProvider></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "My order requests" }));
  expect(await screen.findByText(/Partially delivered/)).toBeVisible();
  const groups = screen.getByRole("region", { name: "Fulfilment by store" });
  expect(groups).toHaveTextContent("Gucci");
  expect(groups).toHaveTextContent("Delivered");
  expect(groups).toHaveTextContent("NikeUnable to fulfil");
  expect(screen.getByRole("link", { name: "Review this item" })).toHaveAttribute("href", "/products/gucci-bag?reviewItem=item-1#reviews");
  expect(screen.queryByText("Request cancellation")).not.toBeInTheDocument();
});

it("requires an exact confirmation before account deletion", async () => {
  account.intent = "buy";
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter><QueryClientProvider client={client}><AccountDetails userId="user-1" email="ada@example.com" /></QueryClientProvider></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "account.myDetails" }));
  fireEvent.click(await screen.findByRole("button", { name: "account.delete" }));
  const confirm = screen.getByLabelText("Type DELETE to confirm");
  const remove = screen.getByRole("button", { name: "Delete permanently" });
  expect(remove).toBeDisabled();
  fireEvent.change(confirm, { target: { value: "DELETE" } });
  expect(remove).toBeEnabled();
});

it("uploads and saves an editable profile photo", async () => {
  account.intent = "buy";
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter><QueryClientProvider client={client}><AccountDetails userId="user-1" email="ada@example.com" /></QueryClientProvider></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "account.myDetails" }));
  const file = new File(["photo"], "avatar.jpg", { type: "image/jpeg" });
  fireEvent.change(screen.getByLabelText("Upload photo"), { target: { files: [file] } });
  await waitFor(() => expect(account.upload).toHaveBeenCalledWith("user-1/avatar", file, { contentType: "image/jpeg", upsert: true }));
  expect(account.update).toHaveBeenCalledWith(expect.objectContaining({ avatar_url: expect.stringContaining("profile-media/user-1/avatar?v=") }));
  expect(await screen.findByText("Profile photo updated.")).toBeVisible();
});
