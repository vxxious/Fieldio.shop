import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { applyTheme, getCurrentTheme, getStoredTheme, THEME_STORAGE_KEY, type Theme } from "../lib/theme";

interface ThemeViewTransition {
  finished: Promise<void>;
  skipTransition: () => void;
}

type ThemeTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ThemeViewTransition;
};

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => getCurrentTheme());
  const activeTransition = useRef<ThemeViewTransition | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const syncSystemTheme = (event: MediaQueryListEvent) => {
      if (getStoredTheme()) return;
      const nextTheme = event.matches ? "dark" : "light";
      applyTheme(nextTheme);
      setTheme(nextTheme);
    };

    const syncStoredTheme = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const nextTheme = event.newValue === "dark" ? "dark" : event.newValue === "light" ? "light" : media.matches ? "dark" : "light";
      applyTheme(nextTheme);
      setTheme(nextTheme);
    };

    media.addEventListener("change", syncSystemTheme);
    window.addEventListener("storage", syncStoredTheme);
    return () => {
      media.removeEventListener("change", syncSystemTheme);
      window.removeEventListener("storage", syncStoredTheme);
      activeTransition.current?.skipTransition();
    };
  }, []);

  const toggleTheme = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const transitionDocument = document as ThemeTransitionDocument;

    if (event.detail === 0 || reducedMotion || !transitionDocument.startViewTransition) {
      applyTheme(nextTheme, true);
      setTheme(nextTheme);
      return;
    }

    activeTransition.current?.skipTransition();

    const bounds = event.currentTarget.getBoundingClientRect();
    const originX = bounds.left + bounds.width / 2;
    const originY = window.innerHeight + 24;
    const farthestX = Math.max(originX, window.innerWidth - originX);
    const radius = Math.hypot(farthestX, originY) + 2;
    const root = document.documentElement;

    root.style.setProperty("--theme-transition-x", `${originX}px`);
    root.style.setProperty("--theme-transition-y", `${originY}px`);
    root.style.setProperty("--theme-transition-radius", `${radius}px`);

    const transition = transitionDocument.startViewTransition(() => {
      applyTheme(nextTheme, true);
      setTheme(nextTheme);
    });
    activeTransition.current = transition;
    void transition.finished.finally(() => {
      if (activeTransition.current === transition) activeTransition.current = null;
    });
  }, [theme]);

  return { theme, toggleTheme };
}
