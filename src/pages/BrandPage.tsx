import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { DiscoveryListing } from "../components/DiscoveryListing";
import { SearchIcon } from "../components/Icons";
import { useDiscoveryOptions } from "../hooks/useDiscoveryProducts";
import { usePageMeta } from "../hooks/usePageMeta";
import { brandSeo } from "../lib/brand-seo";
import { createWhatsAppUrl } from "../lib/whatsapp";
import { useLocale } from "../context/LocaleContext";

const alphabet = ["#", ...Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index))];
const brandLetter = (name: string) => {
  const initial = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase();
  return /^[A-Z]$/.test(initial) ? initial : "#";
};

export function BrandPage() {
  const { t } = useLocale();
  const { slug = "" } = useParams();
  const [query, setQuery] = useState("");
  const [letter, setLetter] = useState("");
  const { data: options, isPending, error, refetch } = useDiscoveryOptions();
  const selectedBrand = options?.brands.find((item) => item.slug === slug);
  const brandNames = options?.brands ?? [];
  const availableLetters = new Set(brandNames.map((item) => brandLetter(item.name)));
  const visibleBrands = brandNames.filter((item) => (!letter || brandLetter(item.name) === letter) && item.name.toLowerCase().includes(query.trim().toLowerCase()));
  const groupedBrands = visibleBrands.reduce<Record<string, typeof brandNames>>((groups, item) => {
    (groups[brandLetter(item.name)] ??= []).push(item);
    return groups;
  }, {});
  const meta = selectedBrand ? brandSeo(selectedBrand.name, selectedBrand.description, selectedBrand.seo_title, selectedBrand.seo_description) : null;
  usePageMeta({
    title: slug ? meta?.title ?? "Brand not found | Fieldio" : "Designer brands | Fieldio",
    description: slug ? meta?.description ?? "This brand is not currently in the Fieldio edit." : "Browse designer brands available through the Fieldio edit and personal sourcing service.",
    canonical: slug ? `https://fieldio.shop/brands/${slug}` : "https://fieldio.shop/brands",
    noIndex: Boolean(slug && !isPending && !error && !selectedBrand)
  });
  const catalogState = error ? <div className="empty-state" role="alert"><h2>{t("catalog.errorTitle")}</h2><button className="primary-button" onClick={() => void refetch()}>{t("common.tryAgain")}</button></div> : isPending ? <div className="product-grid" aria-label={t("catalog.loading")}>{Array.from({ length: 4 }).map((_, index) => <div className="product-skeleton" key={index} />)}</div> : null;
  if (!slug) return (
    <section className="brand-page brand-directory">
      <header><h1>{t("brand.title")}</h1><p>{t("brand.intro")}</p></header>
      <div className="brand-directory-tools">
        <nav className="brand-alphabet" aria-label={t("brand.browseAlphabet")}>
          <button type="button" className={!letter ? "is-active" : ""} aria-pressed={!letter} onClick={() => setLetter("")}>{t("brand.all")}</button>
          {alphabet.map((value) => <button key={value} type="button" className={letter === value ? "is-active" : ""} aria-label={value === "#" ? "Numbers and symbols" : undefined} aria-pressed={letter === value} disabled={!availableLetters.has(value)} onClick={() => { setLetter(value); setQuery(""); }}>{value}</button>)}
        </nav>
        <form className="brand-search" role="search" onSubmit={(event) => event.preventDefault()}>
          <SearchIcon />
          <label className="sr-only" htmlFor="brand-search">{t("brand.search")}</label>
          <input id="brand-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setLetter(""); }} placeholder={t("brand.search")} autoComplete="off" />
          {query && <button className="text-link" type="button" onClick={() => setQuery("")}>{t("common.clear")}</button>}
        </form>
      </div>
      {catalogState}
      {!isPending && !error && <p className="brand-directory-count" aria-live="polite">{visibleBrands.length} {visibleBrands.length === 1 ? t("brand.result") : t("brand.results")}</p>}
      {!isPending && !error && (visibleBrands.length ? (
        <div className="brand-directory-groups">
          {alphabet.filter((value) => groupedBrands[value]?.length).map((value) => (
            <section className="brand-directory-group" key={value} aria-labelledby={`brands-${value}`}>
              <h2 className="brand-directory-letter" id={`brands-${value}`}>{value}</h2>
              <div>{groupedBrands[value]?.map((item) => <Link key={item.slug} to={`/brands/${item.slug}`}>{item.name}</Link>)}</div>
            </section>
          ))}
        </div>
      ) : <div className="empty-state"><h2>{t("brand.noResults")}</h2><button className="text-link" type="button" onClick={() => { setQuery(""); setLetter(""); }}>{t("common.clear")}</button></div>)}
    </section>
  );
  if (catalogState) return <div className="brand-page">{catalogState}</div>;
  if (!selectedBrand) return <section className="not-found"><h1>This brand is not in the edit.</h1><p>Browse the brands currently available through Fieldio.</p><Link to="/brands" className="primary-button">Browse brands</Link></section>;
  return <div className="brand-page"><header><h1>{selectedBrand.name}</h1><p>{selectedBrand.description && selectedBrand.description !== "Fieldio personal sourcing selection." ? selectedBrand.description : t("brand.sourceIntro")}</p><a className="primary-button" href={createWhatsAppUrl(`Hello Fieldio, I would like help sourcing a ${selectedBrand.name} item.`)} target="_blank" rel="noreferrer">{t("brand.request")} {selectedBrand.name}</a></header><DiscoveryListing kind="brand" brandSlug={slug} /></div>;
}
