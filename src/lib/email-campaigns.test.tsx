import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EmailCampaigns } from "../components/admin/EmailCampaigns";

const authenticatedPost = vi.hoisted(() => vi.fn(async () => ({ html: "<p>Campaign preview</p>", recipientCount: 3 })));

vi.mock("./authenticated-api", () => ({ authenticatedPost }));
vi.mock("./supabase", () => ({ supabase: { from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }) } }));

beforeEach(() => authenticatedPost.mockClear());
afterEach(cleanup);

function renderCampaigns() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><EmailCampaigns /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText("Internal campaign name"), { target: { value: "Friday offer" } });
  fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "A Fieldio offer" } });
  fireEvent.change(screen.getByLabelText("Email heading"), { target: { value: "Selected for you" } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "A considered edit." } });
}

it("previews a valid campaign with blank optional fields", async () => {
  renderCampaigns();
  fireEvent.click(screen.getByRole("button", { name: "Preview audience" }));
  await waitFor(() => expect(authenticatedPost).toHaveBeenCalledWith("/api/admin/campaigns", expect.objectContaining({ action: "preview" })));
  expect(await screen.findByText("3 eligible recipients")).toBeVisible();
});

it("sends a test campaign without first saving a draft", async () => {
  renderCampaigns();
  fireEvent.change(screen.getByLabelText("Test recipient"), { target: { value: "admin@fieldio.shop" } });
  fireEvent.click(screen.getByRole("button", { name: "Send test" }));
  await waitFor(() => expect(authenticatedPost).toHaveBeenCalledWith("/api/admin/campaigns", expect.objectContaining({ action: "test", email: "admin@fieldio.shop" })));
  expect(screen.getByText("Test email sent.")).toBeVisible();
});
