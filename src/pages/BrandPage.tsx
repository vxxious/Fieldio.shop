import { Link, useParams } from "react-router-dom";
import { brands as sourcingBrands, getBrandSlug } from "../data/catalog";
import { ProductCard } from "../components/ProductCard";
import { emptyCatalog, useCatalogProducts } from "../hooks/useCatalog";
import { usePageMeta } from "../hooks/usePageMeta";
import { createWhatsAppUrl } from "../lib/whatsapp";
import { useLocale } from "../context/LocaleContext";

export function BrandPage() {
  const { t } = useLocale();
  const { slug = "" } = useParams();
  const { data: products = emptyCatalog, isLoading, error, refetch } = useCatalogProducts();
  const brand = slug.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  const exactBrand = sourcingBrands.find((name) => getBrandSlug(name) === slug) ?? brand;
  const matches = products.filter((product) => product.brand.toLowerCase() === exactBrand.toLowerCase());
  usePageMeta({ title: `${exactBrand} sourcing | Fieldio`, description: `Ask Fieldio to source ${exactBrand} pieces with worldwide shipment support.`, canonical: `https://fieldio.shop/brands/${slug}` });
  const catalogState = error ? <div className="empty-state" role="alert"><h2>{t("catalog.errorTitle")}</h2><button className="primary-button" onClick={() => void refetch()}>{t("common.tryAgain")}</button></div> : isLoading ? <div className="product-grid" aria-label={t("catalog.loading")}>{Array.from({ length: 4 }).map((_, index) => <div className="product-skeleton" key={index} />)}</div> : null;
  if (!slug) return <section className="brand-page"><header><h1>{t("brand.title")}</h1><p>{t("brand.intro")}</p></header>{catalogState}<nav className="brand-list" aria-label={t("brand.title")}>{[...new Set([...sourcingBrands.filter((name) => name !== "Fieldio Edit"), ...products.map((product) => product.brand)])].map((name) => <Link key={name} to={`/brands/${getBrandSlug(name)}`}>{name}</Link>)}</nav></section>;
  return <div className="brand-page"><header><h1>{exactBrand}</h1><p>{t("brand.sourceIntro")}</p><a className="primary-button" href={createWhatsAppUrl(`Hello Fieldio, I would like help sourcing a ${exactBrand} item.`)} target="_blank" rel="noreferrer">{t("brand.request")} {exactBrand}</a></header>{catalogState}{!isLoading && !error && (matches.length ? <section className="product-grid"><h2 className="sr-only">{exactBrand}</h2>{matches.map((product) => <ProductCard key={product.id} product={product} />)}</section> : <div className="empty-state"><h2>{t("brand.emptyTitle")}</h2><p>{t("brand.emptyCopy")}</p><a className="text-link" href={createWhatsAppUrl(`Hello Fieldio, I would like help sourcing a ${exactBrand} item.`)} target="_blank" rel="noreferrer">{t("brand.request")} {exactBrand}</a></div>)}</div>;
}
