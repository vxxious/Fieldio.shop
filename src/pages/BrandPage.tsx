import { Link, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { brands as sourcingBrands, getBrandSlug } from "../data/catalog";
import { ProductCard } from "../components/ProductCard";
import { SearchIcon } from "../components/Icons";
import { emptyCatalog, useCatalogProducts } from "../hooks/useCatalog";
import { usePageMeta } from "../hooks/usePageMeta";
import { createWhatsAppUrl } from "../lib/whatsapp";
import { useLocale } from "../context/LocaleContext";

const alphabet = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index));

export function BrandPage() {
  const { t } = useLocale();
  const { slug = "" } = useParams();
  const [query, setQuery] = useState("");
  const [letter, setLetter] = useState("");
  const { data: products = emptyCatalog, isLoading, error, refetch } = useCatalogProducts();
  const brand = slug.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  const exactBrand = sourcingBrands.find((name) => getBrandSlug(name) === slug) ?? brand;
  const matches = products.filter((product) => product.brand.toLowerCase() === exactBrand.toLowerCase());
  const brandNames = useMemo(() => [...new Set([...sourcingBrands, ...products.map((product) => product.brand)])].filter((name) => name !== "Fieldio Edit").sort((a, b) => a.localeCompare(b)), [products]);
  const availableLetters = useMemo(() => new Set(brandNames.map((name) => name.charAt(0).toUpperCase())), [brandNames]);
  const visibleBrands = brandNames.filter((name) => (!letter || name.toUpperCase().startsWith(letter)) && name.toLowerCase().includes(query.trim().toLowerCase()));
  const groupedBrands = visibleBrands.reduce<Record<string, string[]>>((groups, name) => {
    (groups[name.charAt(0).toUpperCase()] ??= []).push(name);
    return groups;
  }, {});
  usePageMeta({
    title: slug ? `${exactBrand} sourcing | Fieldio` : "Designer brands | Fieldio",
    description: slug ? `Ask Fieldio to source ${exactBrand} pieces with worldwide shipment support.` : "Browse designer brands available through the Fieldio edit and personal sourcing service.",
    canonical: slug ? `https://fieldio.shop/brands/${slug}` : "https://fieldio.shop/brands"
  });
  const catalogState = error ? <div className="empty-state" role="alert"><h2>{t("catalog.errorTitle")}</h2><button className="primary-button" onClick={() => void refetch()}>{t("common.tryAgain")}</button></div> : isLoading ? <div className="product-grid" aria-label={t("catalog.loading")}>{Array.from({ length: 4 }).map((_, index) => <div className="product-skeleton" key={index} />)}</div> : null;
  if (!slug) return (
    <section className="brand-page brand-directory">
      <header><h1>{t("brand.title")}</h1><p>{t("brand.intro")}</p></header>
      <div className="brand-directory-tools">
        <nav className="brand-alphabet" aria-label={t("brand.browseAlphabet")}>
          <button type="button" className={!letter ? "is-active" : ""} aria-pressed={!letter} onClick={() => setLetter("")}>{t("brand.all")}</button>
          {alphabet.map((value) => <button key={value} type="button" className={letter === value ? "is-active" : ""} aria-pressed={letter === value} disabled={!availableLetters.has(value)} onClick={() => { setLetter(value); setQuery(""); }}>{value}</button>)}
        </nav>
        <form className="brand-search" role="search" onSubmit={(event) => event.preventDefault()}>
          <SearchIcon />
          <label className="sr-only" htmlFor="brand-search">{t("brand.search")}</label>
          <input id="brand-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setLetter(""); }} placeholder={t("brand.search")} autoComplete="off" />
          {query && <button className="text-link" type="button" onClick={() => setQuery("")}>{t("common.clear")}</button>}
        </form>
      </div>
      {catalogState}
      <p className="brand-directory-count" aria-live="polite">{visibleBrands.length} {visibleBrands.length === 1 ? t("brand.result") : t("brand.results")}</p>
      {visibleBrands.length ? (
        <div className="brand-directory-groups">
          {alphabet.filter((value) => groupedBrands[value]?.length).map((value) => (
            <section className="brand-directory-group" key={value} aria-labelledby={`brands-${value}`}>
              <h2 className="brand-directory-letter" id={`brands-${value}`}>{value}</h2>
              <div>{groupedBrands[value]?.map((name) => <Link key={name} to={`/brands/${getBrandSlug(name)}`}>{name}</Link>)}</div>
            </section>
          ))}
        </div>
      ) : <div className="empty-state"><h2>{t("brand.noResults")}</h2><button className="text-link" type="button" onClick={() => { setQuery(""); setLetter(""); }}>{t("common.clear")}</button></div>}
    </section>
  );
  return <div className="brand-page"><header><h1>{exactBrand}</h1><p>{t("brand.sourceIntro")}</p><a className="primary-button" href={createWhatsAppUrl(`Hello Fieldio, I would like help sourcing a ${exactBrand} item.`)} target="_blank" rel="noreferrer">{t("brand.request")} {exactBrand}</a></header>{catalogState}{!isLoading && !error && (matches.length ? <section className="product-grid"><h2 className="sr-only">{exactBrand}</h2>{matches.map((product) => <ProductCard key={product.id} product={product} />)}</section> : <div className="empty-state"><h2>{t("brand.emptyTitle")}</h2><p>{t("brand.emptyCopy")}</p><a className="text-link" href={createWhatsAppUrl(`Hello Fieldio, I would like help sourcing a ${exactBrand} item.`)} target="_blank" rel="noreferrer">{t("brand.request")} {exactBrand}</a></div>)}</div>;
}
