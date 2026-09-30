import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { ProductReviews } from "../components/ProductReviews";

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(async (name: string) => ({
    data: name === "review_eligibility"
      ? [
        { order_item_id: "11111111-1111-4111-8111-111111111111", purchased_variant: "Black / M", purchased_size: "M", purchased_color: "Black", purchased_at: "2026-09-23T00:00:00Z", existing_review_id: null },
        { order_item_id: "22222222-2222-4222-8222-222222222222", purchased_variant: "White / L", purchased_size: "L", purchased_color: "White", purchased_at: "2026-09-24T00:00:00Z", existing_review_id: null }
      ]
      : { averageRating: 0, total: 0, breakdown: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }, withPhotos: 0, verified: 0, tags: [] },
    error: null
  }))
}));

vi.mock("../hooks/useSession", () => ({ useSession: () => ({ session: { user: { id: "buyer-1" } }, loading: false }) }));
vi.mock("../hooks/useFocusTrap", () => ({ useFocusTrap: () => undefined }));
vi.mock("./supabase", () => ({
  supabase: {
    rpc,
    from: () => {
      const query = { select: () => query, eq: () => query, order: () => query, range: async () => ({ data: [], error: null, count: 0 }) };
      return query;
    },
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: "" } }) }) }
  }
}));

afterEach(cleanup);

it("renders the review editor at the document overlay layer", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><ProductReviews productId="22222222-2222-4222-8222-222222222222" productName="Fieldio jacket" /></MemoryRouter></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Write a review" }));
  const dialog = screen.getByRole("dialog", { name: "Review your purchase" });
  expect(dialog.closest(".review-modal")?.parentElement).toBe(document.body);
  for (const rating of [5, 3, 2]) {
    const star = screen.getByRole("button", { name: `${rating} stars` });
    fireEvent.click(star);
    expect(star).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(`${rating} out of 5 selected`)).toBeInTheDocument();
  }
});

it("opens the exact delivered item from the account review action", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/products/fieldio-jacket?reviewItem=22222222-2222-4222-8222-222222222222#reviews"]}><ProductReviews productId="33333333-3333-4333-8333-333333333333" productName="Fieldio jacket" /></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByRole("dialog", { name: "Review your purchase" })).toBeVisible();
  await waitFor(() => expect(screen.getByLabelText("Delivered item")).toHaveValue("22222222-2222-4222-8222-222222222222"));
});
