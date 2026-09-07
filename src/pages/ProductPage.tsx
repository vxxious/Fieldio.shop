import { useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { EditorialText } from "../components/EditorialText";
import { HeartIcon, MinusIcon, PlusIcon } from "../components/Icons";
import { RelatedProductsRail } from "../components/RelatedProductsRail";
import { emptyCatalog, useCatalogProduct } from "../hooks/useCatalog";
import { usePageMeta } from "../hooks/usePageMeta";
import { trackEvent } from "../lib/analytics";
import { formatPrice } from "../lib/format";
import { responsiveImage } from "../lib/images";
import { createProductEnquiryUrl } from "../lib/whatsapp";
import { selectCartCount, selectCartSubtotal, useCartStore } from "../store/cart";
import { useWishlistStore } from "../store/wishlist";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";

const accordionItems = ["Description", "Materials & care", "Shipping & returns"] as const;

export function ProductPage() {
  const { slug = "" } = useParams();
  const { product, data: catalog = emptyCatalog, isLoading, error } = useCatalogProduct(slug);
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [showMobilePurchase, setShowMobilePurchase] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);
  const purchaseControlsRef = useRef<HTMLDivElement>(null);
  const addItem = useCartStore((state) => state.addItem);
  const bagCount = useCartStore(selectCartCount);
  const bagSubtotal = useCartStore(selectCartSubtotal);
  const toggleWishlist = useWishlistStore((state) => state.toggle);
  const wished = useWishlistStore((state) => product ? state.productIds.includes(product.id) : false);
  const reduceMotion = useReducedMotion();
  const effectiveVariantId = product?.variants.some((variant) => variant.id === variantId) ? variantId : product?.variants.length === 1 ? product.variants[0]!.id : "";
  const selectedVariant = product?.variants.find((variant) => variant.id === effectiveVariantId);
  const unavailable = Boolean(selectedVariant && selectedVariant.inventory !== null && selectedVariant.inventory < quantity);
  const related = useMemo(() => catalog.filter((item) => item.id !== product?.id).slice(0, 5), [catalog, product?.id]);

  usePageMeta({ title: product?.seoTitle ?? "Product not found | Fieldio", description: product?.seoDescription ?? "This Fieldio product could not be found.", canonical: `https://fieldio.shop/products/${slug}` });

  useEffect(() => { if (product) trackEvent("product_view", { product_id: product.id }); }, [product]);

  useLayoutEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery || reduceMotion) return;
    const context = gsap.context(() => {
      gsap.fromTo(gallery.querySelectorAll(":scope > img, :scope > .gallery-detail"),
        { clipPath: "inset(0 0 100% 0)", willChange: "clip-path" },
        { clipPath: "inset(0 0 0% 0)", duration: 0.72, stagger: 0.08, ease: "power4.inOut", clearProps: "clipPath,willChange" }
      );
    }, gallery);
    return () => context.revert();
  }, [product?.id, reduceMotion]);

  useEffect(() => {
    let animationFrame = 0;
    const updatePurchaseBar = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const controls = purchaseControlsRef.current;
        setShowMobilePurchase(Boolean(controls && controls.getBoundingClientRect().bottom <= 0));
      });
    };
    updatePurchaseBar();
    window.addEventListener("scroll", updatePurchaseBar, { passive: true });
    window.addEventListener("resize", updatePurchaseBar);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", updatePurchaseBar);
      window.removeEventListener("resize", updatePurchaseBar);
    };
  }, [product?.id]);

  if (isLoading) return <div className="route-loading" role="status"><span>Loading the piece</span></div>;
  if (error) return <div className="not-found"><h1>The piece could not load.</h1><p>Refresh the page or ask Fieldio directly.</p><Link to="/contact" className="primary-button">Contact Fieldio</Link></div>;
  if (!product) return <div className="not-found"><h1>Piece not found.</h1><p>This item may have moved or left the edit.</p><Link to="/collections" className="primary-button">Return to the shop</Link></div>;

  const changeVariant = (nextVariantId: string) => {
    setVariantId(nextVariantId);
    const variant = product.variants.find((item) => item.id === nextVariantId);
    if (variant) trackEvent("size_selection", { product_id: product.id, variant_id: variant.id, size: variant.size ?? variant.name });
  };

  const changeQuantity = (nextQuantity: number) => {
    setQuantity(nextQuantity);
    trackEvent("quantity_change", { product_id: product.id, quantity: nextQuantity, source: "product_page" });
  };

  const addToCart = (trigger: HTMLElement, source: "product_page" | "sticky_bar" = "product_page") => {
    if (!selectedVariant || unavailable) {
      toast.error("Choose a size or variant first.");
      return;
    }
    addItem(product, selectedVariant, quantity);
    useCartStore.getState().openCart(trigger);
    trackEvent("add_to_cart", { product_id: product.id, variant_id: selectedVariant.id, quantity, source });
  };

  const selectedLabel = selectedVariant?.size ?? selectedVariant?.name ?? "Select size";
  const bagTotalLabel = product.price === null || bagSubtotal === null ? "To be confirmed" : formatPrice(bagSubtotal, product.currency);
  const availableSizes = product.variants.flatMap((variant) => variant.size ? [variant.size] : []);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    brand: { "@type": "Brand", name: product.brand },
    image: product.images.map((image) => new URL(image.url, window.location.origin).href),
    description: product.description
  };

  return (
    <article className="product-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <div className="product-gallery" ref={galleryRef}>
        {product.images.map((image, index) => <img key={image.id} {...responsiveImage(image.url)} sizes="(max-width: 700px) 100vw, 50vw" alt={image.alt || product.name} loading={index ? "lazy" : "eager"} />)}
        {product.images.length === 1 && <div className="gallery-detail" aria-hidden="true"><img {...responsiveImage(product.images[0]?.url)} sizes="40vw" alt="" /></div>}
        {!product.images.length && <div className="image-placeholder">Photography coming soon</div>}
      </div>
      <section className="product-purchase" aria-labelledby="product-name">
        <div className="product-status"><span>{product.isNewArrival ? "New arrival" : product.collection}</span>{product.inquiryOnly && <span>Request only</span>}</div>
        <p className="product-brand">{product.brand}</p>
        <h1 id="product-name"><EditorialText text={product.name} /></h1>
        <p className="product-price product-price-large">{formatPrice(selectedVariant?.priceOverride ?? product.price, product.currency)}</p>
        {unavailable && <p role="status">This size or quantity is currently unavailable.</p>}
        <p className="product-short">{product.shortDescription}</p>
        <fieldset className="variant-fieldset">
          <legend>{product.variants.some((variant) => variant.size) ? "Select size" : "Request type"}</legend>
          <div className={`variant-grid${product.variants.length === 1 ? " single-option" : ""}`}>
            {product.variants.map((variant) => <label key={variant.id} className={effectiveVariantId === variant.id ? "selected" : ""}><input type="radio" name="variant" value={variant.id} disabled={variant.inventory === 0} checked={effectiveVariantId === variant.id} onChange={() => changeVariant(variant.id)} /><span>{variant.size ?? variant.name}{variant.inventory === 0 ? " · Sold out" : ""}</span></label>)}
          </div>
        </fieldset>
        <div className="purchase-controls" ref={purchaseControlsRef}>
          <div className="quantity-stepper"><button type="button" disabled={quantity <= 1} onClick={() => changeQuantity(quantity - 1)} aria-label={`Decrease quantity for ${product.name}`}><MinusIcon /></button><output aria-label={`Quantity ${quantity}`}>{String(quantity).padStart(2, "0")}</output><button type="button" disabled={quantity >= 10} onClick={() => changeQuantity(quantity + 1)} aria-label={`Increase quantity for ${product.name}`}><PlusIcon /></button></div>
          <Button className="primary-button add-button" type="button" disabled={unavailable || !product.variants.length} onClick={(event) => addToCart(event.currentTarget)}>Add to bag</Button>
          <button className="icon-button wishlist-product" type="button" aria-label={wished ? "Remove from wishlist" : "Add to wishlist"} aria-pressed={wished} onClick={() => toggleWishlist(product.id)}><HeartIcon fill={wished ? "currentColor" : "none"} /></button>
        </div>
        <a className="whatsapp-enquiry" target="_blank" rel="noreferrer" href={createProductEnquiryUrl(product.name, product.sku, window.location.href)}>Ask about this piece on WhatsApp</a>
        <Accordion type="single" defaultValue="Description" collapsible className="product-accordions">
          {accordionItems.map((item) => {
            const content = item === "Description" ? product.description : item === "Materials & care" ? `${product.materials} ${product.care}` : "Worldwide shipping is arranged after availability is confirmed. Returns depend on the sourced item and are confirmed before payment.";
            return <AccordionItem value={item} key={item}><AccordionTrigger>{item}</AccordionTrigger><AccordionContent>{content}</AccordionContent></AccordionItem>;
          })}
        </Accordion>
      </section>
      <section className="product-editorial-details" aria-labelledby="details-fit-title">
        <header><h2 id="details-fit-title"><EditorialText text="Details / Fit" /></h2><p>{product.shortDescription}</p></header>
        <Separator />
        <div className="product-detail-ledger">
          <div><h3>Fit & sizing</h3><p>{availableSizes.length ? `Available request sizes: ${availableSizes.join(", ")}. Exact fit and measurements are confirmed before the order is finalised.` : "Dimensions and fit are confirmed personally for the sourced piece."}</p></div>
          <div><h3>Composition</h3><p>{product.materials}</p></div>
          <div><h3>Care & delivery</h3><p>{product.care} Worldwide delivery timing is confirmed with availability.</p></div>
        </div>
      </section>
      <RelatedProductsRail products={related} />
      <p className="sr-only" aria-live="polite">Selected {selectedLabel}, quantity {quantity}. Bag contains {bagCount} {bagCount === 1 ? "item" : "items"}; total {bagTotalLabel}.</p>
      {showMobilePurchase && <div className="mobile-purchase-bar"><div><p>{product.name}</p><span>{selectedLabel} · Qty {quantity}</span><span>Bag {bagCount} · {bagTotalLabel}</span></div><Button className="primary-button" type="button" disabled={!selectedVariant || unavailable} onClick={(event) => addToCart(event.currentTarget, "sticky_bar")}>Add to bag</Button></div>}
    </article>
  );
}
