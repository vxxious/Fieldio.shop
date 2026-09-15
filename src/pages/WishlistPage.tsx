import { ProductCard } from "../components/ProductCard";
import { emptyCatalog, useCatalogProducts } from "../hooks/useCatalog";
import { usePageMeta } from "../hooks/usePageMeta";
import { useWishlistStore } from "../store/wishlist";
import { Link } from "react-router-dom";
import { useLocale } from "../context/LocaleContext";

export function WishlistPage() {
  const { t } = useLocale();
  const ids = useWishlistStore((state) => state.productIds);
  const { data: products = emptyCatalog, isLoading, error, refetch } = useCatalogProducts();
  const wished = products.filter((product) => ids.includes(product.id));
  usePageMeta({ title: "Wishlist | Fieldio", description: "Your saved Fieldio pieces.", canonical: "https://fieldio.shop/wishlist" });
  return <div className="standard-page wishlist-page"><header><h1>{t("wishlist.title")}</h1><p>{t("wishlist.intro")}</p></header>{error ? <div className="empty-state" role="alert"><h2>{t("catalog.errorTitle")}</h2><button className="primary-button" onClick={() => void refetch()}>{t("common.tryAgain")}</button></div> : isLoading ? <div className="product-grid" aria-label={t("catalog.loading")}>{Array.from({ length: 4 }).map((_, index) => <div className="product-skeleton" key={index} />)}</div> : wished.length ? <section className="product-grid">{wished.map((product) => <ProductCard key={product.id} product={product} />)}</section> : <div className="empty-state"><h2>{t("wishlist.emptyTitle")}</h2><p>{t("wishlist.emptyCopy")}</p><div className="empty-actions"><Link className="primary-button" to="/collections">{t("account.explore")}</Link><Link className="text-link" to="/personal-shopping">{t("wishlist.personal")}</Link></div></div>}</div>;
}
