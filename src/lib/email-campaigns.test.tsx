import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EmailCampaigns } from "../components/admin/EmailCampaigns";

const authenticatedPost = vi.hoisted(() => vi.fn());

vi.mock("./authenticated-api", () => ({ authenticatedPost }));
vi.mock("./supabase", () => ({ supabase: { from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }) } }));

beforeEach(() => {
  authenticatedPost.mockReset().mockImplementation(async (_path: string, body: { action: string }) => {
    if (body.action === "preview") return { html: "<p>Campaign preview</p>", recipientCount: 3 };
    if (body.action === "save") return { campaign: { id: "11111111-1111-4111-8111-111111111111" } };
    if (body.action === "send") return { sent: 3, failed: 0 };
    return {};
  });
});
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
  fireEvent.change(screen.getByLabelText("Test recipient email"), { target: { value: "admin@fieldio.shop" } });
  fireEvent.click(screen.getByRole("button", { name: "Send test email" }));
  await waitFor(() => expect(authenticatedPost).toHaveBeenCalledWith("/api/admin/campaigns", expect.objectContaining({ action: "test", email: "admin@fieldio.shop" })));
  expect(screen.getByText("Test email sent.")).toBeVisible();
});

it("explains an incomplete campaign button instead of failing silently", () => {
  renderCampaigns();
  fireEvent.change(screen.getByLabelText("Button label (optional)"), { target: { value: "https://fieldio.shop" } });
  fireEvent.click(screen.getByRole("button", { name: "Preview audience" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Move the web address to Button URL");
  expect(authenticatedPost).not.toHaveBeenCalled();
});

it("saves the latest draft before sending it", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  renderCampaigns();
  fireEvent.click(screen.getByRole("button", { name: "Save & send campaign" }));
  await waitFor(() => expect(authenticatedPost).toHaveBeenCalledWith("/api/admin/campaigns", expect.objectContaining({ action: "send", campaignId: "11111111-1111-4111-8111-111111111111" })));
  expect(authenticatedPost.mock.calls.map(([, body]) => body.action)).toEqual(["save", "send"]);
  expect(screen.getByText("Resend accepted 3 messages.")).toBeVisible();
});
