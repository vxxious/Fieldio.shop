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
import { useLocale } from "../context/LocaleContext";
import { trackEvent } from "../lib/analytics";
import { responsiveImage } from "../lib/images";
import { createProductEnquiryUrl } from "../lib/whatsapp";
import { selectCartCount, selectCartSubtotal, useCartStore } from "../store/cart";
import { useWishlistStore } from "../store/wishlist";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import type { TranslationKey } from "../lib/translations";

const accordionItems: Array<{ value: string; label: TranslationKey }> = [
  { value: "Description", label: "product.description" },
  { value: "Size & fit", label: "product.sizeFit" },
  { value: "Materials & care", label: "product.materialsCare" },
  { value: "Shipping & returns", label: "product.shippingReturns" }
];

export function ProductPage() {
  const { formatMoney, t } = useLocale();
  const { slug = "" } = useParams();
  const { product, data: catalog = emptyCatalog, isLoading, error, refetch } = useCatalogProduct(slug);
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
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

  useEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery || !product?.images.length) return;
    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const images = Array.from(gallery.querySelectorAll<HTMLElement>(":scope > img"));
        const center = gallery.scrollLeft + gallery.clientWidth / 2;
        const closest = images.reduce((best, image, index) => {
          const distance = Math.abs(image.offsetLeft + image.offsetWidth / 2 - center);
          return distance < best.distance ? { index, distance } : best;
        }, { index: 0, distance: Number.POSITIVE_INFINITY });
        setActiveImage(closest.index);
      });
    };
    gallery.addEventListener("scroll", update, { passive: true });
    update();
    return () => { window.cancelAnimationFrame(frame); gallery.removeEventListener("scroll", update); };
  }, [product?.id, product?.images.length]);

  if (isLoading) return <div className="route-loading" role="status"><span>{t("product.loading")}</span></div>;
  if (error) return <div className="not-found" role="alert"><h1>{t("product.loadErrorTitle")}</h1><p>{t("product.loadErrorCopy")}</p><div className="empty-actions"><button type="button" className="primary-button" onClick={() => void refetch()}>{t("common.tryAgain")}</button><Link to="/contact" className="text-link">{t("account.contactFieldio")}</Link></div></div>;
  if (!product) return <div className="not-found"><h1>{t("product.notFoundTitle")}</h1><p>{t("product.notFoundCopy")}</p><Link to="/collections" className="primary-button">{t("product.returnShop")}</Link></div>;

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
      toast.error(t("product.selectSize"));
      return;
    }
    addItem(product, selectedVariant, quantity);
    useCartStore.getState().openCart(trigger);
    trackEvent("add_to_cart", { product_id: product.id, variant_id: selectedVariant.id, quantity, source });
  };

  const selectedLabel = selectedVariant?.size ?? selectedVariant?.name ?? t("product.selectSize");
  const bagTotalLabel = product.price === null || bagSubtotal === null ? t("cart.confirm") : formatMoney(bagSubtotal, product.currency);
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
      <div className="product-main">
        <div className="product-gallery" ref={galleryRef}>
          {product.images.map((image, index) => <img key={image.id} {...responsiveImage(image.url)} sizes="(max-width: 700px) 100vw, 50vw" alt={image.alt || product.name} loading={index ? "lazy" : "eager"} onLoad={() => { if (index === 0) setActiveImage(0); }} />)}
          {product.images.length === 1 && <div className="gallery-detail" aria-hidden="true"><img {...responsiveImage(product.images[0]?.url)} sizes="40vw" alt="" /></div>}
          {!product.images.length && <div className="image-placeholder">{t("product.photographySoon")}</div>}
          {product.images.length > 1 && <p className="gallery-position" aria-live="polite">{activeImage + 1} / {product.images.length}<span>{t("product.swipe")}</span></p>}
        </div>
        <section className="product-purchase" aria-labelledby="product-name">
        <div className="product-status"><span>{product.isNewArrival ? t("nav.new") : product.collection}</span>{product.inquiryOnly && <span>{t("product.requestOnly")}</span>}</div>
        <p className="product-brand">{product.brand}</p>
        <h1 id="product-name"><EditorialText text={product.name} /></h1>
        <p className="product-price product-price-large">{formatMoney(selectedVariant?.priceOverride ?? product.price, product.currency)}</p>
        {unavailable && <p role="status">{t("product.selectionUnavailable")}</p>}
        <p className="product-short">{product.shortDescription}</p>
        <fieldset className="variant-fieldset">
          <legend>{product.variants.some((variant) => variant.size) ? t("product.selectSize") : t("product.requestType")}</legend>
          <div className={`variant-grid${product.variants.length === 1 ? " single-option" : ""}`}>
            {product.variants.map((variant) => <label key={variant.id} className={effectiveVariantId === variant.id ? "selected" : ""}><input type="radio" name="variant" value={variant.id} disabled={variant.inventory === 0} checked={effectiveVariantId === variant.id} onChange={() => changeVariant(variant.id)} /><span>{variant.size ?? variant.name}{variant.inventory === 0 ? ` · ${t("product.soldOut")}` : ""}</span></label>)}
          </div>
        </fieldset>
        <div className="purchase-controls" ref={purchaseControlsRef}>
          <div className="quantity-stepper"><button type="button" disabled={quantity <= 1} onClick={() => changeQuantity(quantity - 1)} aria-label={`Decrease quantity for ${product.name}`}><MinusIcon /></button><output aria-label={`Quantity ${quantity}`}>{String(quantity).padStart(2, "0")}</output><button type="button" disabled={quantity >= 10} onClick={() => changeQuantity(quantity + 1)} aria-label={`Increase quantity for ${product.name}`}><PlusIcon /></button></div>
          <Button className="primary-button add-button" type="button" disabled={unavailable || !product.variants.length} onClick={(event) => addToCart(event.currentTarget)}>{t("product.addBag")}</Button>
          <button className="icon-button wishlist-product" type="button" aria-label={t(wished ? "product.removeWishlist" : "product.addWishlist")} aria-pressed={wished} onClick={() => toggleWishlist(product.id)}><HeartIcon fill={wished ? "currentColor" : "none"} /></button>
        </div>
        <a className="whatsapp-enquiry" target="_blank" rel="noreferrer" href={createProductEnquiryUrl(product.name, product.sku, window.location.href)}>{t("product.askWhatsApp")}</a>
        <Accordion type="single" defaultValue="Description" collapsible className="product-accordions">
          {accordionItems.map((item) => {
            const content = item.value === "Description" ? product.description : item.value === "Size & fit" ? availableSizes.length ? `${t("product.availableSizes")} ${availableSizes.join(", ")}. ${t("product.exactFit")}` : t("product.fitUnknown") : item.value === "Materials & care" ? `${product.materials} ${product.care}` : t("product.shippingCopy");
            return <AccordionItem value={item.value} key={item.value}><AccordionTrigger>{t(item.label)}</AccordionTrigger><AccordionContent>{content}</AccordionContent></AccordionItem>;
          })}
        </Accordion>
        <div className="product-assurance" aria-label={t("product.assurance")}><p><strong>{t("product.condition")}</strong><span>{t("product.confirmedBeforePayment")}</span></p><p><strong>{t("product.authenticity")}</strong><span>{t("product.authenticityCopy")}</span></p><p><strong>{t("product.delivery")}</strong><span>{t("product.deliveryCopy")}</span></p></div>
        </section>
      </div>
      <section className="product-editorial-details" aria-labelledby="details-fit-title">
        <header><h2 id="details-fit-title"><EditorialText text={t("product.detailsFit")} /></h2><p>{product.shortDescription}</p></header>
        <Separator />
        <div className="product-detail-ledger">
          <div><h3>{t("product.fitSizing")}</h3><p>{availableSizes.length ? `${t("product.availableSizes")} ${availableSizes.join(", ")}. ${t("product.exactFitFinal")}` : t("product.fitUnknown")}</p></div>
          <div><h3>{t("product.composition")}</h3><p>{product.materials}</p></div>
          <div><h3>{t("product.careDelivery")}</h3><p>{product.care} {t("product.worldwideDelivery")}</p></div>
        </div>
      </section>
      <RelatedProductsRail products={related} />
      <p className="sr-only" aria-live="polite">Selected {selectedLabel}, quantity {quantity}. Bag contains {bagCount} {bagCount === 1 ? "item" : "items"}; total {bagTotalLabel}.</p>
      {showMobilePurchase && <div className="mobile-purchase-bar"><div><p>{product.name}</p><span>{selectedLabel} · Qty {quantity}</span><span>{t("nav.bag")} {bagCount} · {bagTotalLabel}</span></div><Button className="primary-button" type="button" disabled={!selectedVariant || unavailable} onClick={(event) => addToCart(event.currentTarget, "sticky_bar")}>{t("product.addBag")}</Button></div>}
    </article>
  );
}
