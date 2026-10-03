import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { products } from "../data/catalog";
import { useCartStore } from "../store/cart";
import { CartDrawer } from "./CartDrawer";

vi.mock("../lib/config", () => ({ catalogPreview: false }));
vi.mock("../lib/supabase", () => ({ supabase: null }));
vi.mock("../context/LocaleContext", () => ({
  useLocale: () => ({
    formatMoney: (value: number | null) => value === null ? "To be confirmed" : `£${(value / 100).toFixed(2)}`,
    t: (key: string) => ({
      "cart.title": "Your bag", "cart.close": "Close cart", "cart.subtotal": "Subtotal", "cart.confirm": "To be confirmed", "cart.confirmationNote": "Confirmed before payment.", "cart.continueCheckout": "Continue to checkout", "cart.continue": "Continue shopping", "cart.empty": "Your edit is empty.", "cart.emptyCopy": "Explore the edit.", "cart.multiStore": "Items from different stores may be prepared and delivered separately. You will still place one Fieldio order."
    }[key] ?? key)
  })
}));

function renderDrawer() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><CartDrawer /></MemoryRouter></QueryClientProvider>);
}

describe("CartDrawer store grouping", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    useCartStore.setState({ items: [], isOpen: false, lastTrigger: null });
  });

  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("keeps a single-store bag simple and preserves quantity and removal controls", () => {
    const product = { ...products[0]!, sellerVerified: true, sellerStoreName: "Atelier A", sellerStoreSlug: "atelier-a" };
    useCartStore.getState().addItem(product, product.variants[0]!);
    renderDrawer();

    expect(screen.getByRole("region", { name: "Atelier A" })).toBeInTheDocument();
    expect(screen.queryByText(/different stores/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(screen.getByRole("status")).toHaveTextContent("02");
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByText("Your edit is empty.")).toBeInTheDocument();
  });

  it("groups multiple stores without exposing private seller information", () => {
    const first = { ...products[0]!, sellerVerified: true, sellerStoreName: "Atelier A", sellerStoreSlug: "atelier-a", sellerEmail: "private@example.com" };
    const second = { ...products[1]!, sellerVerified: true, sellerStoreName: "Studio B", sellerStoreSlug: "studio-b", sellerPhone: "+440000000" };
    useCartStore.getState().addItem(first, first.variants[0]!);
    useCartStore.getState().addItem(second, second.variants[0]!);
    renderDrawer();

    expect(screen.getAllByText(/different stores/i)).toHaveLength(1);
    expect(within(screen.getByRole("region", { name: "Atelier A" })).getByText(first.name)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Studio B" })).getByText(second.name)).toBeInTheDocument();
    expect(screen.queryByText("private@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("+440000000")).not.toBeInTheDocument();
  });
});
