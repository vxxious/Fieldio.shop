import { Link, useParams } from "react-router-dom";
import { CheckSealIcon } from "../components/Icons";
import { ProductCard } from "../components/ProductCard";
import { useLocale } from "../context/LocaleContext";
import { emptyCatalog, useCatalogProducts } from "../hooks/useCatalog";
import { usePageMeta } from "../hooks/usePageMeta";

export function StorePage() {
  const { slug = "" } = useParams();
  const { language } = useLocale();
  const { data: catalog = emptyCatalog, isLoading, error, refetch } = useCatalogProducts();
  const products = catalog.filter((product) => product.sellerVerified && product.sellerStoreSlug === slug);
  const store = products[0];
  const storeName = store?.sellerStoreName ?? "Verified seller";
  const location = store?.sellerCountryCode ? new Intl.DisplayNames([language.locale], { type: "region" }).of(store.sellerCountryCode) ?? store.sellerCountryCode : "Location confirmed by Fieldio";

  usePageMeta({ title: `${storeName} | Verified Fieldio seller`, description: `Shop approved listings from ${storeName} on Fieldio.`, canonical: `https://fieldio.shop/stores/${slug}` });

  if (isLoading) return <div className="route-loading" role="status"><span>Loading seller store</span></div>;
  if (error) return <div className="not-found" role="alert"><h1>Store unavailable</h1><p>The seller store could not load.</p><button className="primary-button" onClick={() => void refetch()}>Try again</button></div>;
  if (!store) return <div className="not-found"><h1>Store not found.</h1><p>This seller may not have any approved listings yet.</p><Link className="primary-button" to="/collections">Explore the edit</Link></div>;

  return <main className="store-page">
    <header><div className="store-verification"><CheckSealIcon /><span>Identity and listings reviewed by Fieldio</span></div><div className="store-heading">{store.sellerStoreLogo && <img src={store.sellerStoreLogo} alt={`${storeName} logo`} />}<h1>{storeName}</h1></div><p>{location} · {products.length} approved {products.length === 1 ? "listing" : "listings"}</p></header>
    <div className="store-service-notes"><p><strong>Response</strong><span>Timing varies by request; Fieldio replies directly.</span></p><p><strong>Policies</strong><span><Link to="/promise">Fieldio Promise</Link> · <Link to="/shipping">Delivery and returns</Link></span></p></div>
    <section className="product-grid" aria-label={`${storeName} products`}>{products.map((product) => <ProductCard key={product.id} product={product} />)}</section>
    <p className="store-disclaimer">Verification confirms that Fieldio reviewed the seller information and listing before publication. Ask for any additional product evidence you need before payment.</p>
  </main>;
}
