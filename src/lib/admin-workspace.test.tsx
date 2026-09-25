import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { AdminWorkspace } from "../components/admin/AdminWorkspace";
import { adminResources } from "./admin-resources";

const authenticatedPost = vi.hoisted(() => vi.fn(async () => ({ emailDelivered: true })));
const deleteBrand = vi.hoisted(() => vi.fn());

vi.mock("./authenticated-api", () => ({ authenticatedPost }));

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => ({
      select: (columns: string) => ({
        order: () => columns === "*"
          ? { range: async () => ({ data: table === "order_requests" ? [{ id: "33333333-3333-4333-8333-333333333333", public_reference: "FLD-1001", customer_name: "Ada", customer_email: "ada@example.com", status: "order_request", created_at: "2026-09-12" }] : table === "brands" ? [{ id: "11111111-1111-4111-8111-111111111111", name: "Louis Vuitton", slug: "louis-vuitton", is_active: true }] : [], count: ["order_requests", "brands"].includes(table) ? 1 : 0, error: null }) }
          : { limit: async () => ({ data: table === "brands" ? [{ id: "11111111-1111-4111-8111-111111111111", name: "Louis Vuitton" }] : [{ id: "22222222-2222-4222-8222-222222222222", name: "Bags" }], error: null }) }
      }),
      delete: () => ({ eq: (_key: string, id: unknown) => ({ select: () => ({ maybeSingle: async () => { deleteBrand(id); return { data: { id }, error: null }; } }) }) })
    })
  }
}));

it("uses named catalog choices and human price inputs", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const products = adminResources.find((resource) => resource.table === "products")!;
  render(<QueryClientProvider client={client}><AdminWorkspace resource={products} /></QueryClientProvider>);
  await screen.findByText("No records yet.");
  screen.getByRole("button", { name: "Add record" }).click();
  expect(await screen.findByRole("option", { name: "Louis Vuitton" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Bags" })).toBeInTheDocument();
  expect(screen.getByLabelText("Price (blank for request)")).toHaveAttribute("step", "0.01");
});

it("updates order status through the guarded RPC", async () => {
  authenticatedPost.mockClear();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const orders = adminResources.find((resource) => resource.table === "order_requests")!;
  const view = render(<QueryClientProvider client={client}><AdminWorkspace resource={orders} /></QueryClientProvider>);
  await within(view.container).findByText("FLD-1001");
  fireEvent.click(within(view.container).getByRole("button", { name: "Edit" }));
  fireEvent.change(await within(view.container).findByLabelText("Order status"), { target: { value: "awaiting_confirmation" } });
  fireEvent.click(within(view.container).getByRole("button", { name: "Save record" }));
  await waitFor(() => expect(authenticatedPost).toHaveBeenCalledWith("/api/order-status", {
    orderId: "33333333-3333-4333-8333-333333333333",
    status: "awaiting_confirmation"
  }));
});

it("keeps unsaved admin edits when record replacement is cancelled", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const products = adminResources.find((resource) => resource.table === "products")!;
  const view = render(<QueryClientProvider client={client}><AdminWorkspace resource={products} /></QueryClientProvider>);
  const workspace = within(view.container);
  await workspace.findByText("No records yet.");
  fireEvent.click(workspace.getByRole("button", { name: "Add record" }));
  fireEvent.change(workspace.getByLabelText("Name"), { target: { value: "Unsaved coat" } });
  fireEvent.click(workspace.getByRole("button", { name: "Add record" }));
  expect(confirm).toHaveBeenCalledWith("Discard unsaved changes?");
  expect(workspace.getByLabelText("Name")).toHaveValue("Unsaved coat");
  view.unmount();
  confirm.mockRestore();
});

it("lets a Super admin delete a brand after confirmation", async () => {
  deleteBrand.mockClear();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const brands = adminResources.find((resource) => resource.table === "brands")!;
  const view = render(<QueryClientProvider client={client}><AdminWorkspace resource={brands} canDelete /></QueryClientProvider>);
  const workspace = within(view.container);
  await workspace.findByText("Louis Vuitton");
  fireEvent.click(workspace.getByRole("button", { name: "Edit" }));
  fireEvent.click(workspace.getByRole("button", { name: "Delete brand" }));
  await waitFor(() => expect(deleteBrand).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111"));
  confirm.mockRestore();
});
