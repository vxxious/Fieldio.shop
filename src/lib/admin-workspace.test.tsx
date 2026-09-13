import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { AdminWorkspace } from "../components/admin/AdminWorkspace";
import { adminResources } from "./admin-resources";

const rpc = vi.hoisted(() => vi.fn(async () => ({ data: null, error: null })));

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        order: () => ["products", "order_requests"].includes(table)
          ? { range: async () => ({ data: table === "order_requests" ? [{ id: "33333333-3333-4333-8333-333333333333", public_reference: "FLD-1001", customer_name: "Ada", customer_email: "ada@example.com", status: "order_request", created_at: "2026-09-12" }] : [], count: table === "order_requests" ? 1 : 0, error: null }) }
          : { limit: async () => ({ data: table === "brands" ? [{ id: "11111111-1111-4111-8111-111111111111", name: "Louis Vuitton" }] : [{ id: "22222222-2222-4222-8222-222222222222", name: "Bags" }], error: null }) }
      })
    }),
    rpc
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
  rpc.mockClear();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const orders = adminResources.find((resource) => resource.table === "order_requests")!;
  const view = render(<QueryClientProvider client={client}><AdminWorkspace resource={orders} /></QueryClientProvider>);
  await within(view.container).findByText("FLD-1001");
  fireEvent.click(within(view.container).getByRole("button", { name: "Edit" }));
  fireEvent.change(await within(view.container).findByLabelText("Order status"), { target: { value: "awaiting_confirmation" } });
  fireEvent.click(within(view.container).getByRole("button", { name: "Save record" }));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("update_order_request_status", {
    p_order_id: "33333333-3333-4333-8333-333333333333",
    p_status: "awaiting_confirmation"
  }));
});
