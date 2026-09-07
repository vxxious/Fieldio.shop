import { ProductCard } from "../components/ProductCard";
import { emptyCatalog, useCatalogProducts } from "../hooks/useCatalog";
import { usePageMeta } from "../hooks/usePageMeta";
import { useWishlistStore } from "../store/wishlist";

export function WishlistPage() {
  const ids = useWishlistStore((state) => state.productIds);
  const { data: products = emptyCatalog } = useCatalogProducts();
  const wished = products.filter((product) => ids.includes(product.id));
  usePageMeta({ title: "Wishlist | Fieldio", description: "Your saved Fieldio pieces.", canonical: "https://fieldio.shop/wishlist" });
  return <div className="standard-page wishlist-page"><header><h1>Your wishlist</h1><p>Keep an edit of pieces to ask about later.</p></header>{wished.length ? <section className="product-grid">{wished.map((product) => <ProductCard key={product.id} product={product} />)}</section> : <div className="empty-state"><h2>Nothing saved yet.</h2><p>Use the heart on any piece to keep it here.</p></div>}</div>;
}
