import { Link, useSearchParams } from "react-router-dom";
import { useDiscoveryOptions, useDiscoveryProducts } from "../hooks/useDiscoveryProducts";
import { ProductCard } from "./ProductCard";
import { regionOptions } from "../lib/regions";

const currencies = [...new Set(regionOptions.map((region) => region.currency))].sort();

function priceFilter(value: string | null) {
  if (value === null || value === "") return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : undefined;
}

export function DiscoveryListing({ kind, brandSlug, gender: fixedGender }: { kind: "new" | "sale" | "brand"; brandSlug?: string; gender?: string }) {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);
  const options = useDiscoveryOptions();
  const currency = params.get("currency") || "";
  const productCategory = params.get("productCategory") || "";
  const categoryId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(productCategory) ? productCategory : "";
  const discovery = useDiscoveryProducts({ kind, ...(brandSlug ? { brandSlug } : {}), ...(fixedGender || params.get("gender") ? { gender: fixedGender || params.get("gender")! } : {}), ...(!brandSlug && params.get("brand") ? { brandId: params.get("brand")! } : {}), ...(categoryId ? { categoryId } : {}), ...(currency ? { currency } : {}), ...(currency && priceFilter(params.get("min")) !== undefined ? { minPrice: priceFilter(params.get("min"))! } : {}), ...(currency && priceFilter(params.get("max")) !== undefined ? { maxPrice: priceFilter(params.get("max"))! } : {}), sort: currency ? params.get("sort") || "newest" : "newest", page });
  const products = discovery.data?.products ?? [];
  const total = discovery.data?.total ?? 0;
  const pageCount = Math.ceil(total / 12);
  const change = (key: string, value: string) => setParams((current) => {
    const next = new URLSearchParams(current);
    if (value) next.set(key, value); else next.delete(key);
    next.delete("page");
    if (key === "currency" && !value) { next.delete("min"); next.delete("max"); next.delete("sort"); }
    return next;
  });
  const go = (nextPage: number) => setParams((current) => { const next = new URLSearchParams(current); next.set("page", String(nextPage)); return next; });
  const pageNumbers = [...new Set([1, page - 1, page, page + 1, pageCount])].filter((number) => number >= 1 && number <= pageCount).sort((left, right) => left - right);

  return <>
    <div className="collection-filters discovery-filters" aria-label="Filter products">
      {!fixedGender && <label>Shop for<select value={params.get("gender") || ""} onChange={(event) => change("gender", event.target.value)}><option value="">Everyone</option><option value="men">Men</option><option value="women">Women</option></select></label>}
      {!brandSlug && <label>Brand<select value={params.get("brand") || ""} onChange={(event) => change("brand", event.target.value)} disabled={options.isPending || Boolean(options.error)}><option value="">All brands</option>{options.data?.brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>}
      <label>Category<select value={categoryId} onChange={(event) => change("productCategory", event.target.value)} disabled={options.isPending || Boolean(options.error)}><option value="">All categories</option>{options.data?.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label>Currency<select value={currency} onChange={(event) => change("currency", event.target.value)}><option value="">All currencies</option>{currencies.map((code) => <option key={code} value={code}>{code}</option>)}</select></label>
      <label>Min price ({currency || "choose currency"})<input type="number" min="0" step="0.01" disabled={!currency} defaultValue={params.get("min") || ""} key={`min-${params.get("min")}`} onBlur={(event) => change("min", event.target.value)} /></label>
      <label>Max price ({currency || "choose currency"})<input type="number" min="0" step="0.01" disabled={!currency} defaultValue={params.get("max") || ""} key={`max-${params.get("max")}`} onBlur={(event) => change("max", event.target.value)} /></label>
      <label>Sort<select value={currency ? params.get("sort") || "newest" : "newest"} onChange={(event) => change("sort", event.target.value)}><option value="newest">Newest first</option><option value="price-low" disabled={!currency}>Price: low to high</option><option value="price-high" disabled={!currency}>Price: high to low</option></select></label>
      <p aria-live="polite">{total} {total === 1 ? "piece" : "pieces"}</p>
    </div>
    {options.error && <p className="catalog-notice" role="alert">Filters could not load. <button className="text-link" onClick={() => void options.refetch()}>Try again</button></p>}
    {discovery.error ? <div className="empty-state" role="alert"><h2>The edit could not load.</h2><button className="primary-button" onClick={() => void discovery.refetch()}>Try again</button></div>
      : discovery.isPending ? <div className="product-grid" aria-label="Loading products">{Array.from({ length: 4 }).map((_, index) => <div className="product-skeleton" key={index} />)}</div>
      : products.length ? <section className="product-grid"><h2 className="sr-only">Products</h2>{products.map((product) => <ProductCard key={product.id} product={product} />)}</section>
      : <div className="empty-state"><h2>{page > 1 && total ? "No pieces on this page." : "No pieces in this edit yet."}</h2><p>Adjust the filters or ask Fieldio to source something specific.</p><Link className="text-link" to="/personal-shopping">Ask a personal shopper</Link></div>}
    {pageCount > 1 && <nav className="discovery-pagination" aria-label="Product pages"><button type="button" disabled={page <= 1} onClick={() => go(page - 1)}>Previous</button>{pageNumbers.map((number) => <button key={number} type="button" aria-current={number === page ? "page" : undefined} onClick={() => go(number)}>{number}</button>)}<button type="button" disabled={page >= pageCount} onClick={() => go(page + 1)}>Next</button></nav>}
  </>;
}
