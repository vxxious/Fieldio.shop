import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { AccountDetails } from "../components/AccountDetails";

const account = vi.hoisted(() => ({ intent: null as "buy" | "sell" | null, orders: [] as Array<Record<string, unknown>>, update: vi.fn() }));

vi.mock("../context/LocaleContext", () => ({
  useLocale: () => ({ formatMoney: () => "£0", language: { locale: "en-GB" }, t: (key: string) => ({ "account.wantBuy": "I want to buy", "account.yourAccount": "Your account", "account.myRequests": "My order requests", "account.copyReference": "Copy reference", "account.referenceCopied": "Reference copied" })[key] ?? key })
}));

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => table === "order_requests"
        ? { eq: () => ({ order: async () => ({ data: account.orders, error: null }) }) }
        : { eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }), maybeSingle: async () => ({ data: table === "profiles" ? { full_name: "Ada Example", phone: null, avatar_url: null, account_intent: account.intent } : null, error: null }) }) },
      update: (value: { account_intent?: "buy" | "sell" }) => ({ eq: async () => { account.update(value); account.intent = value.account_intent ?? account.intent; return { error: null }; } }),
      upsert: async () => ({ error: null })
    }),
    auth: { signOut: async () => ({ error: null }), resetPasswordForEmail: async () => ({ error: null }) }
  }
}));

beforeEach(() => { account.intent = null; account.orders = []; account.update.mockClear(); });

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
  account.orders = [{ id: "order-1", public_reference: "FLD-123", status: "confirmed", created_at: "2026-09-18T00:00:00Z", subtotal: null, currency: "GBP", order_items: [] }];
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter><QueryClientProvider client={client}><AccountDetails userId="user-1" email="ada@example.com" /></QueryClientProvider></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "My order requests" }));
  fireEvent.click(await screen.findByRole("button", { name: "Copy reference" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("FLD-123"));
  expect(screen.getByRole("button", { name: "Reference copied" })).toBeVisible();
});
