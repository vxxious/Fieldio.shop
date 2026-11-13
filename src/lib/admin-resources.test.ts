import { expect, it } from "vitest";
import { adminResourcesFor, parseAdminValues, type AdminResource } from "./admin-resources";

const resource: AdminResource = {
  table: "products",
  title: "Products",
  roles: ["owner", "admin", "editor"],
  columns: [],
  fields: [{ key: "price", label: "Price", type: "money" }]
};

it("converts editable currency amounts to database minor units", () => {
  expect(parseAdminValues(resource, { price: "149.95" })).toEqual({ price: 14995 });
  expect(parseAdminValues(resource, { price: "" })).toEqual({ price: null });
});

it("exposes admin offer fields while deriving Sale and New In from publication data", () => {
  const fields = adminResourcesFor("editor").find(({ table }) => table === "products")!.fields.map(({ key }) => key);
  expect(fields).toEqual(expect.arrayContaining(["compare_at_price", "sale_starts_at", "sale_ends_at"]));
  expect(fields).not.toContain("is_sale");
  expect(fields).not.toContain("is_new_arrival");
  const offer: AdminResource = { ...resource, fields: [...resource.fields, { key: "compare_at_price", label: "Original price", type: "money" }] };
  expect(parseAdminValues(offer, { price: "80", compare_at_price: "100" })).toEqual({ price: 8000, compare_at_price: 10000 });
});

it("limits each staff role to its operational area", () => {
  expect(adminResourcesFor("editor").map(({ table }) => table)).toContain("products");
  expect(adminResourcesFor("editor").map(({ table }) => table)).not.toContain("order_requests");
  expect(adminResourcesFor("fulfilment").map(({ table }) => table)).toEqual(["inventory"]);
  expect(adminResourcesFor("admin").map(({ table }) => table)).not.toContain("order_requests");
});
