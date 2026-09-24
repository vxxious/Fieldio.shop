import { useLayoutEffect } from "react";

const revealSelector = [
  ".product-editorial-details",
  ".related-products",
  ".checkout-layout",
  ".content-sections > section",
  ".service-page > section",
  ".account-page > section"
].join(",");

export function MotionDirector({ routeKey }: { routeKey: string }) {
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root = document.getElementById("main-content");
    if (!root) return;

    let cancelled = false;
    let dispose = () => undefined;

    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([{ default: gsap }, { ScrollTrigger }]) => {
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const animations: Array<{ kill: () => void }> = [];
      let frame = 0;
      const bindMotion = () => {
      root.querySelectorAll<HTMLElement>("h1:not(:has(.editorial-text)), h2:not(.sr-only):not(.brand-directory-letter):not(:has(.editorial-text))").forEach((heading) => {
        if (heading.dataset.motionBound) return;
        heading.dataset.motionBound = "true";
        animations.push(gsap.fromTo(heading,
          { opacity: 0, transform: "translateY(24px)", clipPath: "inset(0 0 100% 0)" },
          { opacity: 1, transform: "translateY(0)", clipPath: "inset(0 0 0% 0)", duration: 0.72, ease: "power4.out", clearProps: "transform,clipPath,opacity", scrollTrigger: { trigger: heading, start: "top 90%", once: true } }
        ));
      });

      root.querySelectorAll<HTMLElement>(revealSelector).forEach((section) => {
        if (section.dataset.motionBound) return;
        section.dataset.motionBound = "true";
        animations.push(gsap.fromTo(section,
          { opacity: 0, transform: "translateY(28px)" },
          { opacity: 1, transform: "translateY(0)", duration: 0.64, ease: "power3.out", clearProps: "transform,opacity", scrollTrigger: { trigger: section, start: "top 88%", once: true } }
        ));
      });

      root.querySelectorAll<HTMLElement>(".product-grid").forEach((grid) => {
        if (grid.dataset.motionBound) return;
        grid.dataset.motionBound = "true";
        const cards = grid.querySelectorAll<HTMLElement>(":scope > .product-card");
        if (!cards.length) return;
        animations.push(gsap.fromTo(cards,
          { opacity: 0, transform: "translateY(18px)" },
          { opacity: 1, transform: "translateY(0)", duration: 0.48, stagger: 0.055, ease: "power3.out", clearProps: "transform,opacity", scrollTrigger: { trigger: grid, start: "top 90%", once: true } }
        ));
      });
      };

      const scheduleBind = () => {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(() => {
          bindMotion();
          ScrollTrigger.refresh();
        });
      };

      scheduleBind();
      const observer = new MutationObserver(scheduleBind);
      observer.observe(root, { childList: true, subtree: true });
      dispose = () => {
        observer.disconnect();
        window.cancelAnimationFrame(frame);
        animations.forEach((animation) => animation.kill());
      };
    });

    return () => {
      cancelled = true;
      dispose();
    };
  }, [routeKey]);

  return null;
}
