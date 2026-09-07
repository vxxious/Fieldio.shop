import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Suspense, useEffect, useRef } from "react";
import { useOutlet, useLocation, useNavigationType } from "react-router-dom";
import { trackEvent } from "../lib/analytics";
import { catalogPreview } from "../lib/config";
import { CartDrawer } from "./CartDrawer";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { SmoothScroll } from "./SmoothScroll";
import { WishlistSync } from "./WishlistSync";
import { MotionDirector } from "./MotionDirector";

export function AppLayout() {
  const location = useLocation();
  const outlet = useOutlet();
  const navigationType = useNavigationType();
  const reduceMotion = useReducedMotion();
  const mainRef = useRef<HTMLElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const previousPathRef = useRef(location.pathname);

  useEffect(() => {
    if (navigationType !== "POP") window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    trackEvent("page_view", { path: location.pathname });
    const routeChanged = previousPathRef.current !== location.pathname;
    previousPathRef.current = location.pathname;
    if (!routeChanged) return;
    let frame = 0;
    const deadline = window.performance.now() + 4_000;
    const restoreRouteContext = () => {
      const nextMain = Array.from(document.querySelectorAll<HTMLElement>("main[data-route]")).find((element) => element.dataset.route === location.pathname);
      const heading = nextMain?.querySelector("h1");
      if ((!nextMain || !heading) && window.performance.now() < deadline) {
        frame = window.requestAnimationFrame(restoreRouteContext);
        return;
      }
      nextMain?.focus({ preventScroll: true });
      const destination = heading?.querySelector(".sr-only")?.textContent?.trim()
        || heading?.textContent?.trim()
        || document.title.split("|")[0]?.trim()
        || "Fieldio";
      if (statusRef.current) statusRef.current.textContent = `Navigated to ${destination}`;
    };
    frame = window.requestAnimationFrame(restoreRouteContext);
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, navigationType, reduceMotion]);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <SmoothScroll />
      <WishlistSync />
      <SiteHeader />
      {catalogPreview && <p className="preview-notice" role="note">Design preview · Images and pieces are illustrative. The live catalog will contain Fieldio-approved products.</p>}
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          ref={mainRef}
          id="main-content"
          data-route={location.pathname}
          key={location.pathname}
          tabIndex={-1}
          initial={reduceMotion ? false : { opacity: 0, transform: "translateY(18px)", clipPath: "inset(0 0 3% 0)" }}
          animate={{ opacity: 1, transform: "translateY(0)", clipPath: "inset(0 0 0% 0)" }}
          exit={reduceMotion ? { opacity: 1 } : { opacity: 0, transform: "translateY(-8px)", transition: { duration: 0.18, ease: [0.23, 1, 0.32, 1] } }}
          transition={{ duration: reduceMotion ? 0 : 0.44, ease: [0.23, 1, 0.32, 1] }}
        >
          <MotionDirector routeKey={location.pathname} />
          <Suspense fallback={<div className="route-loading" role="status"><span>Loading the edit</span></div>}>
            {outlet}
          </Suspense>
        </motion.main>
      </AnimatePresence>
      <SiteFooter />
      <CartDrawer />
      <div ref={statusRef} id="status-region" className="sr-only" role="status" aria-live="polite" />
    </div>
  );
}
