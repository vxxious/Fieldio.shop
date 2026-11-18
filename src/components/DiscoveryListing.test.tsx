import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { CollectionPage } from "../pages/CollectionPage";
import { DiscoveryListing } from "./DiscoveryListing";

const categoryId = vi.hoisted(() => "11111111-1111-4111-8111-111111111111");
const discoveryQuery = vi.hoisted(() => vi.fn((filters: { kind: string; gender?: string }) => ({ data: { products: [{ id: "matched", name: `${filters.gender ?? "all"} ${filters.kind} piece` }], total: 100 }, error: null, isPending: false, refetch: vi.fn() })));
vi.mock("../hooks/useDiscoveryProducts", () => ({
  useDiscoveryProducts: discoveryQuery,
  useDiscoveryOptions: () => ({ data: { brands: [{ id: "prada", name: "Prada", slug: "prada" }], categories: [{ id: categoryId, name: "Coats", slug: "coats" }] }, error: null, isPending: false })
}));
vi.mock("./EditorialText", () => ({ EditorialText: ({ text }: { text: string }) => <>{text}</> }));
vi.mock("./ProductCard", () => ({ ProductCard: ({ product }: { product: { name: string } }) => <article>{product.name}</article> }));

afterEach(() => { cleanup(); discoveryQuery.mockClear(); });

it("preserves combined filters while paging and resets to page one when a filter changes", () => {
  render(<MemoryRouter initialEntries={["/collections/sale?gender=men&currency=GBP&sort=price-low&page=2"]}><DiscoveryListing kind="sale" /></MemoryRouter>);
  expect(discoveryQuery).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "sale", gender: "men", currency: "GBP", sort: "price-low", page: 2 }));
  expect(screen.getByRole("button", { name: "3" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(discoveryQuery).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "sale", gender: "men", currency: "GBP", sort: "price-low", page: 3 }));
  fireEvent.change(screen.getByRole("combobox", { name: "Brand" }), { target: { value: "prada" } });
  expect(discoveryQuery).toHaveBeenLastCalledWith(expect.objectContaining({ brandId: "prada", gender: "men", currency: "GBP", sort: "price-low", page: 1 }));
});

it("requires a currency for meaningful price filters and price sorting", () => {
  render(<MemoryRouter initialEntries={["/collections/new-arrivals"]}><DiscoveryListing kind="new" /></MemoryRouter>);
  expect(screen.getByRole("spinbutton", { name: /Min price/ })).toBeDisabled();
  expect(screen.getByRole("option", { name: "Price: low to high" })).toBeDisabled();
  fireEvent.change(screen.getByRole("combobox", { name: "Currency" }), { target: { value: "GBP" } });
  expect(screen.getByRole("spinbutton", { name: /Min price/ })).toBeEnabled();
  fireEvent.change(screen.getByRole("spinbutton", { name: /Min price/ }), { target: { value: "25.50" } });
  fireEvent.blur(screen.getByRole("spinbutton", { name: /Min price/ }));
  expect(discoveryQuery).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "new", currency: "GBP", minPrice: 2550, page: 1 }));
});

it.each([
  ["men", "new-in", "new"],
  ["men", "sale", "sale"],
  ["women", "new-in", "new"],
  ["women", "sale", "sale"]
])("keeps %s %s discovery separate from product category", (gender, routeCategory, kind) => {
  render(<MemoryRouter initialEntries={[`/collections/${gender}?category=${routeCategory}`]}><Routes><Route path="/collections/:slug" element={<CollectionPage />} /></Routes></MemoryRouter>);
  expect(screen.getByText(`${gender} ${kind} piece`)).toBeVisible();
  expect(discoveryQuery).toHaveBeenLastCalledWith(expect.objectContaining({ kind, gender, page: 1 }));
  expect(discoveryQuery.mock.lastCall?.[0]).not.toHaveProperty("categoryId");
  fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: categoryId } });
  expect(discoveryQuery).toHaveBeenLastCalledWith(expect.objectContaining({ kind, gender, categoryId, page: 1 }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(discoveryQuery).toHaveBeenLastCalledWith(expect.objectContaining({ kind, gender, categoryId, page: 2 }));
});

it("keeps ordinary product-category filtering on Sale", () => {
  render(<MemoryRouter initialEntries={["/collections/sale"]}><DiscoveryListing kind="sale" /></MemoryRouter>);
  fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: categoryId } });
  expect(discoveryQuery).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "sale", categoryId, page: 1 }));
});

it("never forwards a non-UUID product category to discovery", () => {
  render(<MemoryRouter initialEntries={["/collections/sale?productCategory=new-in"]}><DiscoveryListing kind="sale" /></MemoryRouter>);
  expect(discoveryQuery.mock.lastCall?.[0]).not.toHaveProperty("categoryId");
});

it("preserves brand discovery while filtering by product category", () => {
  render(<MemoryRouter initialEntries={[`/brands/prada?productCategory=${categoryId}`]}><DiscoveryListing kind="brand" brandSlug="prada" /></MemoryRouter>);
  expect(discoveryQuery).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "brand", brandSlug: "prada", categoryId, page: 1 }));
});

it.each([
  ["new", "No new arrivals right now."],
  ["sale", "No current offers."]
] as const)("gives an empty %s collection useful next steps", (kind, title) => {
  discoveryQuery.mockReturnValueOnce({ data: { products: [], total: 0 }, error: null, isPending: false, refetch: vi.fn() });
  render(<MemoryRouter initialEntries={[kind === "new" ? "/collections/new-arrivals" : "/collections/sale"]}><DiscoveryListing kind={kind} /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: title })).toBeVisible();
  expect(screen.getByRole("link", { name: "Browse all pieces" })).toHaveAttribute("href", "/collections");
  expect(screen.getByRole("link", { name: "Ask a personal shopper" })).toHaveAttribute("href", "/personal-shopping");
});

it("distinguishes an empty filtered result from an empty collection", () => {
  discoveryQuery.mockReturnValueOnce({ data: { products: [], total: 0 }, error: null, isPending: false, refetch: vi.fn() });
  render(<MemoryRouter initialEntries={["/collections/sale?gender=men"]}><DiscoveryListing kind="sale" /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "No pieces match these filters." })).toBeVisible();
});

it("preserves the existing brand empty state", () => {
  discoveryQuery.mockReturnValueOnce({ data: { products: [], total: 0 }, error: null, isPending: false, refetch: vi.fn() });
  render(<MemoryRouter initialEntries={["/brands/prada"]}><DiscoveryListing kind="brand" brandSlug="prada" /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "No pieces in this edit yet." })).toBeVisible();
  expect(screen.queryByRole("link", { name: "Browse all pieces" })).not.toBeInTheDocument();
});
