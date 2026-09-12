import { useEffect, useRef, useState } from "react";
import { ArrowUpIcon } from "./Icons";

const IDLE_DELAY_MS = 1_400;

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const idleTimerRef = useRef<number | undefined>(undefined);
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const clearIdleTimer = () => {
      if (idleTimerRef.current !== undefined) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = undefined;
      }
    };

    const updateVisibility = () => {
      frameRef.current = undefined;
      const documentHeight = document.documentElement.scrollHeight;
      const distanceFromBottom = documentHeight - (window.scrollY + window.innerHeight);
      const nearBottom = documentHeight > window.innerHeight * 1.5
        && window.scrollY > window.innerHeight
        && distanceFromBottom <= Math.max(420, window.innerHeight * 0.65);

      clearIdleTimer();
      setVisible(nearBottom);
      if (nearBottom) {
        idleTimerRef.current = window.setTimeout(() => setVisible(false), IDLE_DELAY_MS);
      }
    };

    const onScroll = () => {
      if (frameRef.current === undefined) {
        frameRef.current = window.requestAnimationFrame(updateVisibility);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      clearIdleTimer();
      if (frameRef.current !== undefined) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const scrollToTop = () => {
    setVisible(false);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, left: 0, behavior: reducedMotion ? "auto" : "smooth" });
  };

  return (
    <button
      className="scroll-to-top"
      type="button"
      aria-label="Scroll to top"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      data-visible={visible || undefined}
      onFocus={() => {
        if (idleTimerRef.current !== undefined) window.clearTimeout(idleTimerRef.current);
      }}
      onBlur={() => setVisible(false)}
      onClick={scrollToTop}
    >
      <ArrowUpIcon />
    </button>
  );
}
