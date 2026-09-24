import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useRequireAccount } from "../hooks/useRequireAccount";
import { trackEvent } from "../lib/analytics";
import { useLocale } from "../context/LocaleContext";
import { responsiveImage } from "../lib/images";
import { productCondition, productSizeSummary } from "../lib/product-trust";
import { useCartStore } from "../store/cart";
import { useWishlistStore } from "../store/wishlist";
import type { Product } from "../types/catalog";
import { HeartIcon } from "./Icons";

export function ProductCard({ product, priority = false, quickAdd = false }: { product: Product; priority?: boolean; quickAdd?: boolean }) {
  const [showSizes, setShowSizes] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const toggleWishlist = useWishlistStore((state) => state.toggle);
  const wished = useWishlistStore((state) => state.productIds.includes(product.id));
  const { requireAccount } = useRequireAccount();
  const reduceMotion = useReducedMotion();
  const { formatMoney, t } = useLocale();
  const singleVariant = product.variants.length === 1 ? product.variants[0] : undefined;
  const quickLabel = product.inquiryOnly ? t("product.quickRequest") : t("product.quickAdd");

  const addVariant = async (variant: Product["variants"][number], trigger: HTMLElement) => {
    if (!await requireAccount()) return;
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
        {product.isNewArrival && <div className="product-badges"><span className="product-badge">{t("product.new")}</span></div>}
        <button
          className="wishlist-button"
          type="button"
          onClick={async () => { if (!await requireAccount()) return; toggleWishlist(product.id); if (!wished) trackEvent("wishlist_addition", { product_id: product.id }); }}
          aria-label={wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          aria-pressed={wished}
        >
          <HeartIcon fill={wished ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="product-card-info">
        <div className="product-card-copy">
          <Link to={`/products/${product.slug}`}>
            <p className="product-brand">{product.brand}</p>
            <h3>{product.name}</h3>
            <p className="product-price">{formatMoney(product.price, product.currency)}</p>
          </Link>
          <p className="product-card-options">{productSizeSummary(product)}{product.condition ? ` · ${productCondition(product)}` : ""}</p>
          {product.sellerVerified && product.sellerStoreSlug && <Link className="product-card-seller" to={`/stores/${product.sellerStoreSlug}`}>Verified seller{product.sellerCountryCode ? ` · ${product.sellerCountryCode}` : ""}</Link>}
        </div>
        {quickAdd ? (
          <div className="related-quick-add">
            {singleVariant ? <button type="button" className="quick-action" disabled={singleVariant.inventory === 0} onClick={(event) => void addVariant(singleVariant, event.currentTarget)}>{singleVariant.inventory === 0 ? t("product.unavailable") : quickLabel}</button> : <>
              <button type="button" className="quick-action" aria-expanded={showSizes} onClick={() => setShowSizes((value) => !value)}>{showSizes ? t("product.closeSizes") : quickLabel}</button>
              {showSizes && <div className="quick-size-options" role="group" aria-label={`${quickLabel} ${product.name} by size`}>{product.variants.map((variant) => <button key={variant.id} type="button" disabled={variant.inventory === 0} aria-label={`${quickLabel} ${product.name}, ${variant.size ?? variant.name}`} onClick={(event) => void addVariant(variant, event.currentTarget)}>{variant.size ?? variant.name}</button>)}</div>}
            </>}
          </div>
        ) : singleVariant ? (
          <button type="button" className="quick-action" disabled={singleVariant.inventory === 0} onClick={async (event) => { if (!await requireAccount()) return; addItem(product, singleVariant); useCartStore.getState().openCart(event.currentTarget); trackEvent("add_to_cart", { product_id: product.id }); }}>
            {singleVariant.inventory === 0 ? t("product.outOfStock") : t("product.addRequest")}
          </button>
        ) : (
          <Link to={`/products/${product.slug}`} className="quick-action">{t("product.selectOptions")}</Link>
        )}
      </div>
    </article>
  );
}
