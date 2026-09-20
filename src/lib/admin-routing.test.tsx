import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { AccountPage } from "../pages/AccountPage";
import { AdminPage } from "../pages/AdminPage";

const state = vi.hoisted(() => ({ adminRole: "owner" as string | null, accountRole: "admin" as "buyer" | "seller" | "admin", mfaLevel: "aal2" }));

vi.mock("../hooks/useSession", () => ({ useSession: () => ({ session: { user: { id: "admin-1", email: "admin@example.com", user_metadata: {} } }, loading: false }) }));
vi.mock("../hooks/usePageMeta", () => ({ usePageMeta: () => undefined }));
vi.mock("../context/LocaleContext", () => ({ useLocale: () => ({ t: (key: string) => key }) }));
vi.mock("../components/AccountDetails", () => ({ AccountDetails: ({ accountRole }: { accountRole: string }) => <div>{accountRole} account</div> }));
vi.mock("../components/admin/AdminWorkspace", () => ({ AdminWorkspace: ({ resource }: { resource: { title: string } }) => <div>{resource.title} workspace</div> }));
vi.mock("../components/admin/SellerModeration", () => ({ SellerModeration: () => <div>Seller review workspace</div> }));
vi.mock("./supabase", () => ({
  supabase: {
    rpc: async (name: string) => ({ data: name === "current_account_role" ? state.accountRole : state.adminRole, error: null }),
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: async () => ({ error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: state.mfaLevel, nextLevel: "aal2" }, error: null }),
        listFactors: async () => ({ data: { all: [], totp: [] }, error: null })
      }
    }
  }
}));

function renderWithApp(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
}

beforeEach(() => { state.adminRole = "owner"; state.accountRole = "admin"; state.mfaLevel = "aal2"; });

it("sends a signed-in staff account directly to administration", async () => {
  renderWithApp(<Routes><Route path="/" element={<AccountPage />} /><Route path="/admin" element={<div>Admin destination</div>} /></Routes>);
  expect(await screen.findByText("Admin destination")).toBeVisible();
  expect(screen.queryByText("Buyer account")).not.toBeInTheDocument();
});

it("keeps an approved seller in the seller account experience", async () => {
  state.accountRole = "seller";
  renderWithApp(<AccountPage />);
  expect(await screen.findByText("seller account")).toBeVisible();
});

it("provides one compact section selector for the admin workspace", async () => {
  renderWithApp(<AdminPage />);
  const selector = await screen.findByRole("combobox", { name: "Manage" });
  expect(selector).toHaveValue("products");
  expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();
  fireEvent.change(selector, { target: { value: "brands" } });
  expect(await screen.findByText("Brands workspace")).toBeVisible();
});

it("blocks staff tools until two-step verification is complete", async () => {
  state.mfaLevel = "aal1";
  const view = renderWithApp(<AdminPage />);
  expect(await view.findByRole("heading", { name: "Secure admin access" })).toBeVisible();
  expect(view.container.querySelector("select")).toBeNull();
});
