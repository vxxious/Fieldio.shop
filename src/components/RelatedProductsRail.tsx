import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Product } from "../types/catalog";
import { useLocale } from "../context/LocaleContext";
import { ArrowIcon } from "./Icons";
import { ProductCard } from "./ProductCard";
import { Button } from "./ui/button";

export function RelatedProductsRail({ products }: { products: Product[] }) {
  const { t } = useLocale();
  const railRef = useRef<HTMLOListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updatePosition = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    setAtStart(rail.scrollLeft <= 2);
    setAtEnd(rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    updatePosition();
    rail.addEventListener("scroll", updatePosition, { passive: true });
    const observer = new ResizeObserver(updatePosition);
    observer.observe(rail);
    return () => {
      rail.removeEventListener("scroll", updatePosition);
      observer.disconnect();
    };
  }, [products.length, updatePosition]);

  const move = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({
      left: direction * rail.clientWidth * 0.78,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
    if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
  };

  return (
    <section className="related-products" aria-labelledby="related-products-title">
      <div className="section-heading">
        <h2 id="related-products-title">{t("product.related")}</h2>
        <div className="rail-controls" aria-label="Related product navigation">
          <Button variant="outline" size="icon" type="button" onClick={() => move(-1)} disabled={atStart} aria-label="Previous related products"><ArrowIcon /></Button>
          <Button variant="outline" size="icon" type="button" onClick={() => move(1)} disabled={atEnd} aria-label="Next related products"><ArrowIcon /></Button>
        </div>
      </div>
      <ol ref={railRef} className="related-products-rail" tabIndex={0} onKeyDown={handleKeyDown} aria-label="Related products. Use left and right arrow keys to browse.">
        {products.map((product) => <li key={product.id}><ProductCard product={product} quickAdd /></li>)}
      </ol>
    </section>
  );
}
