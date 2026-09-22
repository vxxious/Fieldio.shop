import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccountDetails } from "../components/AccountDetails";

const account = vi.hoisted(() => ({ intent: null as "buy" | "sell" | null, avatar: null as string | null, orders: [] as Array<Record<string, unknown>>, update: vi.fn(), upload: vi.fn() }));
vi.mock("./authenticated-api", () => ({ authenticatedPost: vi.fn() }));

vi.mock("../context/LocaleContext", () => ({
  useLocale: () => ({ formatMoney: () => "£0", language: { locale: "en-GB" }, t: (key: string) => ({ "account.wantBuy": "I want to buy", "account.yourAccount": "Your account", "account.myRequests": "My order requests", "account.copyReference": "Copy reference", "account.referenceCopied": "Reference copied" })[key] ?? key })
}));

vi.mock("./supabase", () => ({
  supabase: {
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

beforeEach(() => { account.intent = null; account.avatar = null; account.orders = []; account.update.mockClear(); account.upload.mockReset().mockResolvedValue({ error: null }); });
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
