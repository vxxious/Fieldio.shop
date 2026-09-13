import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { CheckoutPage } from "../pages/CheckoutPage";
import { useCartStore } from "../store/cart";
import { products } from "../data/catalog";

vi.mock("./config", () => ({ catalogPreview: false }));
vi.mock("./supabase", () => ({ supabase: null }));
vi.mock("../context/LocaleContext", () => ({
  useLocale: () => ({
    region: { code: "GB", currency: "GBP" },
    language: { locale: "en-GB" },
    formatMoney: (value: number | null, currency: string) => value === null ? "Price on request" : new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value / 100),
    t: (key: string) => ({
      "checkout.title": "Complete your request", "checkout.notice": "No payment is taken here.", "checkout.customer": "Customer & delivery", "checkout.name": "Full name", "checkout.phone": "Phone number", "checkout.email": "Email address", "checkout.address": "Shipping address", "checkout.note": "Note", "checkout.optional": "Optional", "checkout.consent": "I understand this sends an order request.", "checkout.preparing": "Preparing request…", "checkout.continue": "Continue on WhatsApp", "checkout.request": "Your request", "checkout.shipping": "Shipping is confirmed before payment.", "checkout.destination": "Delivery destination", "checkout.ukShipping": "UK delivery is confirmed before payment.", "checkout.paymentTitle": "Payment after confirmation", "checkout.paymentMethods": "Bank transfer, card arrangement, or cryptocurrency may be available by arrangement.", "checkout.failed": "The order request was not completed. Review your bag and try again, or contact Fieldio.", "checkout.quantity": "Qty", "cart.subtotal": "Subtotal", "cart.confirm": "To be confirmed", "common.loading": "Loading"
    }[key] ?? key)
  })
}));

const product = products[0]!;
const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "The order request was not completed. Review your bag and try again." }) });

afterEach(() => { useCartStore.getState().clearCart(); fetchMock.mockClear(); vi.unstubAllGlobals(); });

it("submits identifiers only and shows a recoverable server error", async () => {
  vi.stubGlobal("fetch", fetchMock);
  useCartStore.getState().addItem(product, product.variants[0]!);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><MemoryRouter><CheckoutPage /></MemoryRouter></QueryClientProvider>);
  expect(screen.getByText("United Kingdom · GBP")).toBeInTheDocument();
  expect(screen.getByText(/cryptocurrency may be available by arrangement/i)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ada Lovelace" } });
  fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "+447000000000" } });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "ada@example.com" } });
  fireEvent.change(screen.getByLabelText("Shipping address"), { target: { value: "10 London Road, London, United Kingdom" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Continue on WhatsApp" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("The order request was not completed"));
  expect(screen.queryByRole("link", { name: "Open prepared WhatsApp message" })).not.toBeInTheDocument();
  const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as { items: Record<string, unknown>[] };
  expect(body.items[0]).not.toHaveProperty("unitPrice");
  expect(body.items[0]).not.toHaveProperty("productName");
});
