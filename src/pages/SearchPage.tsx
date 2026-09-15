import { useMemo, useState } from "react";
import { ProductCard } from "../components/ProductCard";
import { emptyCatalog, useCatalogProducts } from "../hooks/useCatalog";
import { usePageMeta } from "../hooks/usePageMeta";
import { trackEvent } from "../lib/analytics";
import { SearchIcon } from "../components/Icons";
import { createWhatsAppUrl } from "../lib/whatsapp";
import { useLocale } from "../context/LocaleContext";

export function SearchPage() {
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const { data: products = emptyCatalog, isLoading, error, refetch } = useCatalogProducts();
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return products.filter((product) => [product.name, product.brand, product.category, ...product.tags].some((value) => value.toLowerCase().includes(normalized)));
  }, [products, query]);
  usePageMeta({ title: "Search | Fieldio", description: "Search the Fieldio edit by product, brand, or category.", canonical: "https://fieldio.shop/search" });
  return <div className="search-page"><h1>{t("search.title")}</h1><form role="search" onSubmit={(event) => { event.preventDefault(); trackEvent("search", { query }); }}><SearchIcon /><label htmlFor="site-search" className="sr-only">{t("search.label")}</label><input id="site-search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search.placeholder")} />{query && <button className="search-clear" type="button" onClick={() => setQuery("")}>{t("common.clear")}</button>}</form>{error ? <div className="empty-state" role="alert"><h2>{t("catalog.errorTitle")}</h2><button className="primary-button" onClick={() => void refetch()}>{t("common.tryAgain")}</button></div> : isLoading ? <div className="product-grid" aria-label={t("catalog.loading")}>{Array.from({ length: 4 }).map((_, index) => <div className="product-skeleton" key={index} />)}</div> : <>{query && <p className="search-count">{results.length} {results.length === 1 ? t("search.result") : t("search.results")}</p>}{query && !results.length ? <div className="empty-state"><h2>{t("search.emptyTitle")}</h2><p>{t("search.emptyCopy")}</p><div className="empty-actions"><button className="text-link" type="button" onClick={() => setQuery("")}>{t("search.clear")}</button><a className="primary-button" href={createWhatsAppUrl(`Hello Fieldio, I am looking for ${query.trim()}.`)} target="_blank" rel="noreferrer">{t("search.source")}</a></div></div> : <section className="product-grid">{results.map((product) => <ProductCard key={product.id} product={product} />)}</section>}</>}</div>;
}
