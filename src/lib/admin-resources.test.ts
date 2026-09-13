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

it("limits each staff role to its operational area", () => {
  expect(adminResourcesFor("editor").map(({ table }) => table)).toContain("products");
  expect(adminResourcesFor("editor").map(({ table }) => table)).not.toContain("order_requests");
  expect(adminResourcesFor("fulfilment").map(({ table }) => table)).toEqual(["inventory", "order_requests"]);
});
