import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { CheckoutPage } from "../pages/CheckoutPage";
import { useCartStore } from "../store/cart";
import { products } from "../data/catalog";

vi.mock("./config", () => ({ catalogPreview: false }));
vi.mock("./supabase", () => ({ supabase: null }));
afterEach(() => { vi.unstubAllGlobals(); useCartStore.setState({ items: [], isOpen: false }); });

it("blocks the WhatsApp handoff when the server rejects unavailable stock", async () => {
  const product = products[0]!;
  useCartStore.getState().addItem(product, product.variants[0]!);
  const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "This variant is unavailable." }) });
  vi.stubGlobal("fetch", fetchMock);
  render(<MemoryRouter><CheckoutPage /></MemoryRouter>);
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
