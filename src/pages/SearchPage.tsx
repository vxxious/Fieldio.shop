import { useMemo, useState } from "react";
import { ProductCard } from "../components/ProductCard";
import { emptyCatalog, useCatalogProducts } from "../hooks/useCatalog";
import { usePageMeta } from "../hooks/usePageMeta";
import { trackEvent } from "../lib/analytics";
import { SearchIcon } from "../components/Icons";
import { createWhatsAppUrl } from "../lib/whatsapp";

export function SearchPage() {
  const [query, setQuery] = useState("");
  const { data: products = emptyCatalog } = useCatalogProducts();
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return products.filter((product) => [product.name, product.brand, product.category, ...product.tags].some((value) => value.toLowerCase().includes(normalized)));
  }, [products, query]);
  usePageMeta({ title: "Search | Fieldio", description: "Search the Fieldio edit by product, brand, or category.", canonical: "https://fieldio.shop/search" });
  return <div className="search-page"><h1>Search the edit</h1><form role="search" onSubmit={(event) => { event.preventDefault(); trackEvent("search", { query }); }}><SearchIcon /><label htmlFor="site-search" className="sr-only">Search products</label><input id="site-search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Product, brand, or category" />{query && <button className="search-clear" type="button" onClick={() => setQuery("")}>Clear</button>}</form>{query && <p className="search-count">{results.length} {results.length === 1 ? "result" : "results"}</p>}{query && !results.length ? <div className="empty-state"><h2>No exact match.</h2><p>Try another term or send Fieldio the item you are looking for.</p><div className="empty-actions"><button className="text-link" type="button" onClick={() => setQuery("")}>Clear search</button><a className="primary-button" href={createWhatsAppUrl(`Hello Fieldio, I am looking for ${query.trim()}.`)} target="_blank" rel="noreferrer">Ask Fieldio to source it</a></div></div> : <section className="product-grid">{results.map((product) => <ProductCard key={product.id} product={product} />)}</section>}</div>;
}
