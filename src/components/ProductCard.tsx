import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { Link } from "react-router-dom";
import { trackEvent } from "../lib/analytics";
import { formatPrice } from "../lib/format";
import { responsiveImage } from "../lib/images";
import { useCartStore } from "../store/cart";
import { useWishlistStore } from "../store/wishlist";
import type { Product } from "../types/catalog";
import { HeartIcon } from "./Icons";

export function ProductCard({ product, priority = false, quickAdd = false }: { product: Product; priority?: boolean; quickAdd?: boolean }) {
  const [showSizes, setShowSizes] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const toggleWishlist = useWishlistStore((state) => state.toggle);
  const wished = useWishlistStore((state) => state.productIds.includes(product.id));
  const reduceMotion = useReducedMotion();
  const singleVariant = product.variants.length === 1 ? product.variants[0] : undefined;
  const quickLabel = product.inquiryOnly ? "Quick request" : "Quick add";

  const addVariant = (variant: Product["variants"][number], trigger: HTMLElement) => {
    addItem(product, variant);
    useCartStore.getState().openCart(trigger);
    trackEvent("quick_add", { product_id: product.id, variant_id: variant.id, source: "related_products" });
    trackEvent("add_to_cart", { product_id: product.id, variant_id: variant.id, source: "related_products" });
  };

  return (
    <article className="product-card">
      <div className="product-card-media">
        <Link to={`/products/${product.slug}`} aria-label={`View ${product.name}`}>
          {product.images.length ? <motion.img
            {...responsiveImage(product.images[0]?.url)}
            sizes="(max-width: 700px) 50vw, 25vw"
            alt={product.images[0]?.alt ?? product.name}
            {...(product.images[0]?.cardCrop ? { style: {
              objectPosition: product.images[0].cardCrop.objectPosition,
              scale: product.images[0].cardCrop.scale
            } } : {})}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            {...(!reduceMotion ? { whileHover: { scale: 1.025 } } : {})}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          /> : <div className="image-placeholder">Photography coming soon</div>}
        </Link>
        {product.isNewArrival && <span className="product-badge">New</span>}
        <button
          className="wishlist-button"
          type="button"
          onClick={() => { toggleWishlist(product.id); if (!wished) trackEvent("wishlist_addition", { product_id: product.id }); }}
          aria-label={wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          aria-pressed={wished}
        >
          <HeartIcon fill={wished ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="product-card-info">
        <Link to={`/products/${product.slug}`}>
          <p className="product-brand">{product.brand}</p>
          <h3>{product.name}</h3>
          <p className="product-price">{formatPrice(product.price, product.currency)}</p>
        </Link>
        {quickAdd ? (
          <div className="related-quick-add">
            {singleVariant ? <button type="button" className="quick-action" disabled={singleVariant.inventory === 0} onClick={(event) => addVariant(singleVariant, event.currentTarget)}>{singleVariant.inventory === 0 ? "Unavailable" : quickLabel}</button> : <>
              <button type="button" className="quick-action" aria-expanded={showSizes} onClick={() => setShowSizes((value) => !value)}>{showSizes ? "Close sizes" : quickLabel}</button>
              {showSizes && <div className="quick-size-options" role="group" aria-label={`${quickLabel} ${product.name} by size`}>{product.variants.map((variant) => <button key={variant.id} type="button" disabled={variant.inventory === 0} aria-label={`${quickLabel} ${product.name}, ${variant.size ?? variant.name}`} onClick={(event) => addVariant(variant, event.currentTarget)}>{variant.size ?? variant.name}</button>)}</div>}
            </>}
          </div>
        ) : singleVariant ? (
          <button type="button" className="quick-action" disabled={singleVariant.inventory === 0} onClick={(event) => { addItem(product, singleVariant); useCartStore.getState().openCart(event.currentTarget); trackEvent("add_to_cart", { product_id: product.id }); }}>
            {singleVariant.inventory === 0 ? "Out of stock" : "Add request"}
          </button>
        ) : (
          <Link to={`/products/${product.slug}`} className="quick-action">Select options</Link>
        )}
      </div>
    </article>
  );
}
