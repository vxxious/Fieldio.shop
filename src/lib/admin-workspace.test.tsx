import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { AdminWorkspace } from "../components/admin/AdminWorkspace";
import { adminResources } from "./admin-resources";

const authenticatedPost = vi.hoisted(() => vi.fn(async () => ({ emailDelivered: true })));
const deleteBrand = vi.hoisted(() => vi.fn());
const insertProduct = vi.hoisted(() => vi.fn());
const productRows = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));

vi.mock("./authenticated-api", () => ({ authenticatedPost }));

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => ({
      select: (columns: string) => ({
        order: () => columns === "*"
          ? { range: async () => ({ data: table === "order_requests" ? [{ id: "33333333-3333-4333-8333-333333333333", public_reference: "FLD-1001", customer_name: "Ada", customer_email: "ada@example.com", status: "order_request", created_at: "2026-09-12" }] : table === "brands" ? [{ id: "11111111-1111-4111-8111-111111111111", name: "Louis Vuitton", slug: "louis-vuitton", is_active: true }] : table === "products" ? productRows.rows : [], count: table === "products" ? productRows.rows.length : ["order_requests", "brands"].includes(table) ? 1 : 0, error: null }) }
          : { limit: async () => ({ data: table === "brands" ? [{ id: "11111111-1111-4111-8111-111111111111", name: "Louis Vuitton" }] : [{ id: "22222222-2222-4222-8222-222222222222", name: "Bags" }], error: null }) }
      }),
      insert: async (payload: Record<string, unknown>) => { if (table === "products") insertProduct(payload); return { error: null }; },
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
  expect(screen.getByLabelText("Selling price (blank for request)")).toHaveAttribute("step", "0.01");
});

it("generates an editable product SKU and slug without changing existing identifiers", async () => {
  insertProduct.mockClear();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const products = adminResources.find((resource) => resource.table === "products")!;
  const view = render(<QueryClientProvider client={client}><AdminWorkspace resource={products} /></QueryClientProvider>);
  const workspace = within(view.container);
  await workspace.findByText("No records yet.");
  fireEvent.click(workspace.getByRole("button", { name: "Add record" }));
  const sku = String((workspace.getByLabelText("SKU") as HTMLInputElement).value);
  expect(sku).toMatch(/^FIELDIO-[A-F0-9]{12}$/);
  fireEvent.change(workspace.getByLabelText("Name"), { target: { value: "BRIKO® Ski Visor Helmet" } });
  expect(workspace.getByLabelText("URL slug")).toHaveValue(`briko-ski-visor-helmet-${sku.slice(8).toLowerCase()}`);
  fireEvent.change(workspace.getByLabelText("URL slug"), { target: { value: "custom-helmet-slug" } });
  fireEvent.change(workspace.getByLabelText("Name"), { target: { value: "Updated helmet name" } });
  expect(workspace.getByLabelText("URL slug")).toHaveValue("custom-helmet-slug");
  fireEvent.change(workspace.getByLabelText("Short description"), { target: { value: "A ski visor helmet." } });
  fireEvent.change(workspace.getByLabelText("Description"), { target: { value: "A ski visor helmet in size M/L." } });
  fireEvent.click(workspace.getByRole("button", { name: "Save record" }));
  await waitFor(() => expect(insertProduct).toHaveBeenCalledWith(expect.objectContaining({ name: "Updated helmet name", slug: "custom-helmet-slug", sku })));
  view.unmount();

  productRows.rows = [{ id: "11111111-1111-4111-8111-111111111111", name: "Existing helmet", slug: "existing-helmet", sku: "EXISTING-001" }];
  try {
    const existingClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const existingView = render(<QueryClientProvider client={existingClient}><AdminWorkspace resource={products} /></QueryClientProvider>);
    const existing = within(existingView.container);
    await existing.findByText("Existing helmet");
    fireEvent.click(existing.getByRole("button", { name: "Edit" }));
    fireEvent.change(existing.getByLabelText("Name"), { target: { value: "Renamed helmet" } });
    expect(existing.getByLabelText("URL slug")).toHaveValue("existing-helmet");
    expect(existing.getByLabelText("SKU")).toHaveValue("EXISTING-001");
    existingView.unmount();
  } finally {
    productRows.rows = [];
  }
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
