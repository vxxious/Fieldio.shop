import gsap from "gsap";
import { useCallback, useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { trackEvent } from "../lib/analytics";
import { formatPrice } from "../lib/format";
import { selectCartSubtotal, useCartStore } from "../store/cart";
import type { CartItem } from "../types/catalog";
import { CloseIcon, MinusIcon, PlusIcon } from "./Icons";
import { Button } from "./ui/button";

function CartRow({ item }: { item: CartItem }) {
  const rowRef = useRef<HTMLLIElement>(null);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);

  const handleRemove = () => {
    trackEvent("remove_from_cart", { product_id: item.productId, variant_id: item.variantId, source: "cart_drawer" });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      removeItem(item.key);
      return;
    }
    gsap.to(rowRef.current, {
      opacity: 0,
      x: 24,
      height: 0,
      paddingTop: 0,
      paddingBottom: 0,
      margin: 0,
      duration: 0.24,
      ease: "power3.inOut",
      onComplete: () => removeItem(item.key)
    });
  };

  const changeQuantity = (next: number) => {
    updateQuantity(item.key, next);
    trackEvent("quantity_change", { product_id: item.productId, variant_id: item.variantId, quantity: next, source: "cart_drawer" });
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.fromTo(rowRef.current?.querySelector(".cart-row-price") ?? null, { transform: "translateY(-5px)", opacity: 0.4 }, { transform: "translateY(0)", opacity: 1, duration: 0.16, ease: "power3.out" });
    }
  };

  return (
    <li ref={rowRef} className="cart-row">
      <img src={item.image} alt="" />
      <div className="cart-row-copy">
        <p className="product-brand">{item.brand}</p>
        <h3>{item.productName}</h3>
        <p className="cart-variant">{item.selectedVariant}</p>
        <div className="cart-row-bottom">
          <div className="quantity-stepper" aria-label={`Quantity for ${item.productName}`}>
            <button type="button" onClick={() => changeQuantity(item.quantity - 1)} disabled={item.quantity <= 1} aria-label="Decrease quantity"><MinusIcon /></button>
            <output aria-live="polite">{String(item.quantity).padStart(2, "0")}</output>
            <button type="button" onClick={() => changeQuantity(item.quantity + 1)} disabled={item.quantity >= 10} aria-label="Increase quantity"><PlusIcon /></button>
          </div>
          <p className="cart-row-price">{formatPrice(item.unitPrice === null ? null : item.unitPrice * item.quantity, item.currency)}</p>
        </div>
        <button className="text-link remove-link" type="button" onClick={handleRemove}>Remove</button>
      </div>
    </li>
  );
}

export function CartDrawer() {
  const isOpen = useCartStore((state) => state.isOpen);
  const storeClose = useCartStore((state) => state.closeCart);
  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore(selectCartSubtotal);
  const trigger = useCartStore((state) => state.lastTrigger);
  const layerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const handleClose = useCallback(() => {
    if (!isOpen) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      storeClose();
      return;
    }
    const layer = layerRef.current;
    const panel = panelRef.current;
    gsap.killTweensOf([layer, panel]);
    gsap.timeline({ onComplete: storeClose })
      .to(panel, { transform: "translateX(100%)", duration: 0.24, ease: "power4.inOut" }, 0)
      .to(layer, { backgroundColor: "rgba(17,18,15,0)", duration: 0.2 }, 0.02);
  }, [isOpen, storeClose]);

  useFocusTrap(panelRef, isOpen, handleClose, trigger);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const context = gsap.context(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.timeline()
        .fromTo(layerRef.current, { backgroundColor: "rgba(17,18,15,0)" }, { backgroundColor: "rgba(17,18,15,.44)", duration: 0.22 }, 0)
        .fromTo(panelRef.current, { transform: "translateX(100%)" }, { transform: "translateX(0%)", duration: 0.28, ease: "power4.out" }, 0)
        .fromTo(".cart-row", { opacity: 0, transform: "translateX(18px)" }, { opacity: 1, transform: "translateX(0)", stagger: 0.04, duration: 0.22, ease: "power3.out" }, 0.08)
        .fromTo(".cart-summary > *", { opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)", stagger: 0.035, duration: 0.2, ease: "power3.out" }, 0.12)
        .fromTo(".empty-cart > *", { opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)", stagger: 0.04, duration: 0.2, ease: "power3.out" }, 0.08);
    }, layerRef);
    return () => context.revert();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div ref={layerRef} className="cart-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) handleClose(); }}>
      <aside ref={panelRef} className="cart-panel" data-lenis-prevent role="dialog" aria-modal="true" aria-labelledby="cart-title" tabIndex={-1}>
        <div className="drawer-header">
          <h2 id="cart-title">Your bag <span>{items.length}</span></h2>
          <button className="icon-button" type="button" onClick={handleClose} aria-label="Close cart"><CloseIcon /></button>
        </div>
        {items.length > 0 ? (
          <>
            <ul className="cart-list">{items.map((item) => <CartRow key={item.key} item={item} />)}</ul>
            <div className="cart-summary">
              <div><span>Subtotal</span><strong>{subtotal === null ? "To be confirmed" : formatPrice(subtotal, items[0]?.currency ?? "GBP")}</strong></div>
              <p>Availability, shipping, and payment are confirmed personally on WhatsApp.</p>
              <Button asChild size="lg" className="primary-button full-button"><Link to="/checkout" onClick={handleClose}>Checkout via WhatsApp</Link></Button>
              <Button type="button" variant="link" className="text-link centered-link" onClick={handleClose}>Continue shopping</Button>
            </div>
          </>
        ) : (
          <div className="empty-cart">
            <p className="empty-cart-title">Your edit is empty.</p>
            <p className="empty-cart-copy">Explore new arrivals or ask Fieldio to source a specific piece.</p>
            <p className="empty-cart-account">Have an account? <Link to="/account" onClick={handleClose}>Log in</Link> to check out faster.</p>
            <Button className="primary-button" type="button" onClick={handleClose}>Continue shopping</Button>
          </div>
        )}
      </aside>
    </div>
  );
}
