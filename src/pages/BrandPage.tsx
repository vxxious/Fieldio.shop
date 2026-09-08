import { Link, useParams } from "react-router-dom";
import { brands as sourcingBrands, getBrandSlug } from "../data/catalog";
import { ProductCard } from "../components/ProductCard";
import { emptyCatalog, useCatalogProducts } from "../hooks/useCatalog";
import { usePageMeta } from "../hooks/usePageMeta";
import { createWhatsAppUrl } from "../lib/whatsapp";

export function BrandPage() {
  const { slug = "" } = useParams();
  const { data: products = emptyCatalog } = useCatalogProducts();
  const brand = slug.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  const exactBrand = sourcingBrands.find((name) => getBrandSlug(name) === slug) ?? brand;
  const matches = products.filter((product) => product.brand.toLowerCase() === exactBrand.toLowerCase());
  usePageMeta({ title: `${exactBrand} sourcing | Fieldio`, description: `Ask Fieldio to source ${exactBrand} pieces with worldwide shipment support.`, canonical: `https://fieldio.shop/brands/${slug}` });
  if (!slug) return <section className="brand-page"><header><h1>Brands</h1><p>Explore the labels in our edit, or ask Fieldio to source a specific piece.</p></header><nav className="brand-list" aria-label="Brands">{[...new Set([...sourcingBrands.filter((name) => name !== "Fieldio Edit"), ...products.map((product) => product.brand)])].map((name) => <Link key={name} to={`/brands/${getBrandSlug(name)}`}>{name}</Link>)}</nav></section>;
  return <div className="brand-page"><header><h1>{exactBrand}</h1><p>Looking for a specific piece? Share the name, reference, or screenshot. Fieldio will confirm authenticity, availability, condition, final price, and shipping before purchase.</p><a className="primary-button" href={createWhatsAppUrl(`Hello Fieldio, I would like help sourcing a ${exactBrand} item.`)} target="_blank" rel="noreferrer">Request {exactBrand}</a></header>{matches.length > 0 && <section className="product-grid"><h2 className="sr-only">{exactBrand} requests</h2>{matches.map((product) => <ProductCard key={product.id} product={product} />)}</section>}</div>;
}
