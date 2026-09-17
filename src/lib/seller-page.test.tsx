import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { SellerPage } from "../pages/SellerPage";

vi.mock("../hooks/useSession", () => ({ useSession: () => ({ session: null, loading: false }) }));
vi.mock("../hooks/usePageMeta", () => ({ usePageMeta: () => undefined }));
vi.mock("../context/LocaleContext", () => ({ useLocale: () => ({ region: { currency: "GBP" } }) }));
vi.mock("./supabase", () => ({ supabase: null }));

it("requires an account before a seller can apply", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter><QueryClientProvider client={client}><SellerPage /></QueryClientProvider></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "Sell with Fieldio" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Create seller account" })).toHaveAttribute("href", "/account?mode=signup&returnTo=%2Fsell");
  expect(screen.getByText(/Every seller and vendor is verified/)).toBeVisible();
});
