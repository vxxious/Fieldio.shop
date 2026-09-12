import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { CheckoutPage } from "../pages/CheckoutPage";
import { useCartStore } from "../store/cart";
import { products } from "../data/catalog";

vi.mock("./config", () => ({ catalogPreview: false }));
vi.mock("./supabase", () => ({ supabase: null }));
vi.mock("../context/LocaleContext", () => ({ useLocale: () => ({ formatMoney: (value: number | null, currency: string) => value === null ? "Price on request" : new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value / 100), t: (key: string) => ({ "checkout.title": "Complete your request", "checkout.notice": "No payment is taken here.", "checkout.customer": "Customer & delivery", "checkout.name": "Full name", "checkout.phone": "Phone number", "checkout.email": "Email address", "checkout.address": "Shipping address", "checkout.note": "Note", "checkout.optional": "Optional", "checkout.consent": "I understand this sends an order request.", "checkout.preparing": "Preparing request…", "checkout.continue": "Continue on WhatsApp", "checkout.request": "Your request", "checkout.shipping": "Shipping is confirmed before payment.", "cart.subtotal": "Subtotal", "cart.confirm": "To be confirmed", "common.loading": "Loading" }[key] ?? key) }) }));
afterEach(() => { vi.unstubAllGlobals(); useCartStore.setState({ items: [], isOpen: false }); });

it("blocks the WhatsApp handoff when the server rejects unavailable stock", async () => {
  const product = products[0]!;
  useCartStore.getState().addItem(product, product.variants[0]!);
  const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "This variant is unavailable." }) });
  vi.stubGlobal("fetch", fetchMock);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><MemoryRouter><CheckoutPage /></MemoryRouter></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ada Example" } });
  fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "+447000000000" } });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "ada@example.com" } });
  fireEvent.change(screen.getByLabelText("Shipping address"), { target: { value: "10 Example Street, London, UK" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Continue on WhatsApp" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("The order request was not completed"));
  expect(screen.queryByRole("link", { name: "Open prepared WhatsApp message" })).not.toBeInTheDocument();
  const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as { items: Record<string, unknown>[] };
  expect(body.items[0]).not.toHaveProperty("unitPrice");
  expect(body.items[0]).not.toHaveProperty("productName");
});
