import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { AccountPage } from "../pages/AccountPage";
import { AdminPage } from "../pages/AdminPage";

const state = vi.hoisted(() => ({ role: "owner" as string | null }));

vi.mock("../hooks/useSession", () => ({ useSession: () => ({ session: { user: { id: "admin-1", email: "admin@example.com", user_metadata: {} } }, loading: false }) }));
vi.mock("../hooks/usePageMeta", () => ({ usePageMeta: () => undefined }));
vi.mock("../context/LocaleContext", () => ({ useLocale: () => ({ t: (key: string) => key }) }));
vi.mock("../components/AccountDetails", () => ({ AccountDetails: () => <div>Buyer account</div> }));
vi.mock("../components/admin/AdminWorkspace", () => ({ AdminWorkspace: ({ resource }: { resource: { title: string } }) => <div>{resource.title} workspace</div> }));
vi.mock("../components/admin/SellerModeration", () => ({ SellerModeration: () => <div>Seller review workspace</div> }));
vi.mock("./supabase", () => ({
  supabase: {
    rpc: async () => ({ data: state.role, error: null }),
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }), signOut: async () => ({ error: null }) }
  }
}));

function renderWithApp(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
}

beforeEach(() => { state.role = "owner"; });

it("sends a signed-in staff account directly to administration", async () => {
  renderWithApp(<Routes><Route path="/" element={<AccountPage />} /><Route path="/admin" element={<div>Admin destination</div>} /></Routes>);
  expect(await screen.findByText("Admin destination")).toBeVisible();
  expect(screen.queryByText("Buyer account")).not.toBeInTheDocument();
});

it("provides one compact section selector for the admin workspace", async () => {
  renderWithApp(<AdminPage />);
  const selector = await screen.findByRole("combobox", { name: "Manage" });
  expect(selector).toHaveValue("products");
  expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();
  fireEvent.change(selector, { target: { value: "brands" } });
  expect(await screen.findByText("Brands workspace")).toBeVisible();
});
