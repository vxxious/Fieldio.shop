import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { products } from "../data/catalog";
import { CheckoutPage, checkoutAttemptKey, checkoutConfirmationKey } from "../pages/CheckoutPage";
import { useCartStore } from "../store/cart";

const userId = "11111111-1111-4111-8111-111111111111";

vi.mock("./config", () => ({ catalogPreview: false }));
vi.mock("./supabase", () => ({ supabase: null }));
vi.mock("../hooks/useSession", () => ({ useSession: () => ({ session: { user: { id: userId, email: "ada@example.com" } }, loading: false }) }));
vi.mock("../context/LocaleContext", () => ({
  useLocale: () => ({
    region: { code: "GB", currency: "GBP" },
    language: { locale: "en-GB" },
    formatMoney: (value: number | null, currency: string) => value === null ? "Price on request" : new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value / 100),
    t: (key: string) => ({
      "checkout.title": "Complete your request", "checkout.notice": "No payment is taken here.", "checkout.customer": "Customer & delivery", "checkout.name": "Full name", "checkout.phone": "Phone number", "checkout.email": "Email address", "checkout.address": "Shipping address", "checkout.note": "Note", "checkout.optional": "Optional", "checkout.consent": "I understand this sends an order request.", "checkout.preparing": "Preparing request…", "checkout.submit": "Send order request", "checkout.request": "Your request", "checkout.shipping": "Shipping is confirmed before payment.", "checkout.destination": "Delivery destination", "checkout.paymentTitle": "Payment after confirmation", "checkout.paymentMethods": "No payment is taken on this website.", "checkout.failed": "The order request was not completed. Review your bag and try again, or contact Fieldio.", "checkout.quantity": "Qty", "checkout.multiStore": "One Fieldio order. Items from different stores may be prepared and delivered separately.", "checkout.confirmationEyebrow": "Fieldio order request", "checkout.confirmationTitle": "Order request received", "checkout.confirmationReceived": "Fieldio has received your request.", "checkout.reference": "Reference", "checkout.paymentState": "Payment", "checkout.paymentPending": "Pending — no payment has been confirmed", "checkout.paymentConfirmed": "Confirmed", "checkout.storeProgress": "Store fulfilment", "checkout.confirmationMultiStore": "Each store may progress separately.", "checkout.nextStep": "Next step", "checkout.nextStepCopy": "Continue on WhatsApp to confirm availability, delivery, and payment details with Fieldio.", "checkout.continueWhatsApp": "Continue on WhatsApp", "checkout.viewOrders": "View my orders", "cart.subtotal": "Subtotal", "cart.confirm": "To be confirmed", "common.loading": "Loading"
    }[key] ?? key)
  })
}));

function renderCheckout() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><CheckoutPage /></MemoryRouter></QueryClientProvider>);
}

function completeForm() {
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ada Lovelace" } });
  fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "+447000000000" } });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "ada@example.com" } });
  fireEvent.change(screen.getByLabelText("Shipping address"), { target: { value: "10 London Road, London, United Kingdom" } });
  fireEvent.click(screen.getByRole("checkbox"));
}

const fetchMock = vi.fn();

describe("checkout request flow", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useCartStore.setState({ items: [], isOpen: false, lastTrigger: null });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("submits identifiers only and never shows success for a failed creation", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "The order request was not completed. Review your bag and try again." }) });
    const product = products[0]!;
    useCartStore.getState().addItem(product, product.variants[0]!);
    renderCheckout();
    completeForm();
    fireEvent.click(screen.getByRole("button", { name: "Send order request" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(await screen.findByText(/The order request was not completed/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Order request received" })).not.toBeInTheDocument();
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as { items: Record<string, unknown>[] };
    expect(body.items[0]).not.toHaveProperty("unitPrice");
    expect(body.items[0]).not.toHaveProperty("productName");
    expect(sessionStorage.getItem(checkoutAttemptKey)).toContain(body.items[0]!.variantId as string);
  });

  it("groups a multi-store checkout while preserving the order total", () => {
    const first = { ...products[0]!, price: 10_000, sellerVerified: true, sellerStoreName: "Atelier A", sellerStoreSlug: "atelier-a" };
    const second = { ...products[1]!, price: 20_000, sellerVerified: true, sellerStoreName: "Studio B", sellerStoreSlug: "studio-b" };
    useCartStore.getState().addItem(first, first.variants[0]!, 2);
    useCartStore.getState().addItem(second, second.variants[0]!);
    renderCheckout();

    expect(screen.getByText(/One Fieldio order/)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Atelier A" })).getByText(first.name)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Studio B" })).getByText(second.name)).toBeInTheDocument();
    const expected = (first.variants[0]!.priceOverride ?? first.price ?? 0) * 2 + (second.variants[0]!.priceOverride ?? second.price ?? 0);
    expect(screen.getByText(new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(expected / 100))).toBeInTheDocument();
  });

  it("shows a durable truthful confirmation before the optional WhatsApp handoff", async () => {
    const product = { ...products[0]!, sellerVerified: true, sellerStoreName: "Atelier A", sellerStoreSlug: "atelier-a" };
    useCartStore.getState().addItem(product, product.variants[0]!);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ reference: "FLD-202610-02001", paymentStatus: "pending", groups: [{ storeName: "Atelier A", itemCount: 1 }], items: useCartStore.getState().items }) });
    const firstRender = renderCheckout();
    completeForm();
    fireEvent.click(screen.getByRole("button", { name: "Send order request" }));

    const heading = await screen.findByRole("heading", { name: "Order request received" });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByText("FLD-202610-02001")).toBeInTheDocument();
    expect(screen.getByText(/Pending — no payment has been confirmed/)).toBeInTheDocument();
    const whatsapp = screen.getByRole("link", { name: "Continue on WhatsApp" });
    expect(whatsapp).toHaveAttribute("href", expect.stringContaining("FLD-202610-02001"));
    whatsapp.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(whatsapp);
    fireEvent.click(whatsapp);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "View my orders" })).toHaveAttribute("href", "/account?view=orders");
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(sessionStorage.getItem(checkoutConfirmationKey)).toContain("FLD-202610-02001");

    firstRender.unmount();
    renderCheckout();
    expect(screen.getByText("FLD-202610-02001")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("reuses the same request key after a failed response and refresh", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "Please try again." }) });
    const product = products[0]!;
    useCartStore.getState().addItem(product, product.variants[0]!);
    const firstRender = renderCheckout();
    completeForm();
    fireEvent.click(screen.getByRole("button", { name: "Send order request" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const firstKey = JSON.parse(fetchMock.mock.calls[0]![1].body as string).requestKey;

    firstRender.unmount();
    renderCheckout();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Send order request" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body as string).requestKey).toBe(firstKey);
  });
});
