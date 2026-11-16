import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { BrandPage } from "./BrandPage";

const options = vi.hoisted(() => ({ brands: [
  { id: "maison", name: "Maison Margiela", slug: "maison-margiela", description: "Explore Maison Margiela on Fieldio. Browse available pieces when listed, or ask for sourcing assistance.", seo_title: null, seo_description: null },
  { id: "prada", name: "Prada", slug: "prada", description: null, seo_title: null, seo_description: null },
  { id: "other-stories", name: "& Other Stories", slug: "and-other-stories", description: null, seo_title: null, seo_description: null },
  { id: "alyx", name: "1017 ALYX 9SM", slug: "1017-alyx-9sm", description: null, seo_title: null, seo_description: null },
  { id: "etudes", name: "Études Studio", slug: "etudes-studio", description: null, seo_title: null, seo_description: null }
], categories: [] }));
vi.mock("../hooks/useDiscoveryProducts", () => ({ useDiscoveryOptions: () => ({ data: options, isPending: false, error: null }), useDiscoveryProducts: () => ({ data: { products: [], total: 0 }, isPending: false, error: null }) }));
vi.mock("../context/LocaleContext", () => ({ useLocale: () => ({ t: (key: string) => key }) }));
vi.mock("../components/DiscoveryListing", () => ({ DiscoveryListing: () => <div>No pieces in this edit yet.</div> }));
vi.mock("../hooks/usePageMeta", () => ({ usePageMeta: vi.fn() }));

afterEach(cleanup);

it("links only database catalogue brands by their stored slugs", () => {
  render(<MemoryRouter initialEntries={["/brands"]}><Routes><Route path="/brands" element={<BrandPage />} /></Routes></MemoryRouter>);
  expect(screen.getByRole("link", { name: "Maison Margiela" })).toHaveAttribute("href", "/brands/maison-margiela");
  expect(screen.getByRole("link", { name: "Prada" })).toHaveAttribute("href", "/brands/prada");
  expect(screen.queryByText("VXXIOUS Store")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "& Other Stories" })).toHaveAttribute("href", "/brands/and-other-stories");
  expect(screen.getByRole("link", { name: "1017 ALYX 9SM" })).toHaveAttribute("href", "/brands/1017-alyx-9sm");
  expect(screen.getByRole("link", { name: "Études Studio" })).toHaveAttribute("href", "/brands/etudes-studio");
});

it("groups numbers, symbols, and accented initials without hiding brands", () => {
  render(<MemoryRouter initialEntries={["/brands"]}><Routes><Route path="/brands" element={<BrandPage />} /></Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Numbers and symbols" }));
  expect(screen.getByRole("link", { name: "& Other Stories" })).toBeVisible();
  expect(screen.getByRole("link", { name: "1017 ALYX 9SM" })).toBeVisible();
  expect(screen.queryByRole("link", { name: "Études Studio" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^E$/ }));
  expect(screen.getByRole("link", { name: "Études Studio" })).toBeVisible();
});

it("shows an empty Maison Margiela page without inventing products", () => {
  render(<MemoryRouter initialEntries={["/brands/maison-margiela"]}><Routes><Route path="/brands/:slug" element={<BrandPage />} /></Routes></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "Maison Margiela" })).toBeVisible();
  expect(screen.getByText("No pieces in this edit yet.")).toBeVisible();
  expect(screen.getByRole("link", { name: "brand.request Maison Margiela" })).toHaveAttribute("href", expect.stringContaining("wa.me"));
});

it("does not render a public brand page for an excluded seller brand", () => {
  render(<MemoryRouter initialEntries={["/brands/vxxious-store-2eeafa"]}><Routes><Route path="/brands/:slug" element={<BrandPage />} /></Routes></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "This brand is not in the edit." })).toBeVisible();
  expect(screen.getByRole("link", { name: "Browse brands" })).toHaveAttribute("href", "/brands");
});
