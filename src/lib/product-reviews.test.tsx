import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { ProductReviews } from "../components/ProductReviews";

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(async (name: string) => ({
    data: name === "review_eligibility"
      ? [{ order_item_id: "11111111-1111-4111-8111-111111111111", purchased_variant: "Black / M", purchased_size: "M", purchased_color: "Black", purchased_at: "2026-09-23T00:00:00Z", existing_review_id: null }]
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

it("renders the review editor at the document overlay layer", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><ProductReviews productId="22222222-2222-4222-8222-222222222222" productName="Fieldio jacket" /></MemoryRouter></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Write a review" }));
  const dialog = screen.getByRole("dialog", { name: "Review your purchase" });
  expect(dialog.closest(".review-modal")?.parentElement).toBe(document.body);
});
