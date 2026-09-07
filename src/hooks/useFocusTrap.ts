import { useEffect, type RefObject } from "react";

const focusableSelector = "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  isActive: boolean,
  onClose: () => void,
  restoreTarget?: HTMLElement | null,
  restoreTargetRef?: RefObject<HTMLElement | null>
): void {
  useEffect(() => {
    if (!isActive || !containerRef.current) return;
    const container = containerRef.current;
    const savedTarget = restoreTarget ?? restoreTargetRef?.current ?? document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const inertNodes: Array<[HTMLElement, boolean]> = [];
    let node: HTMLElement | null = container;
    while (node && node !== document.body) {
      for (const sibling of Array.from(node.parentElement?.children ?? [])) {
        if (sibling !== node && sibling instanceof HTMLElement) {
          inertNodes.push([sibling, sibling.inert]); sibling.inert = true;
        }
      }
      node = node.parentElement;
    }
    const getFocusable = () => Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => element.getClientRects().length && !element.closest("[inert]"));
    const frame = requestAnimationFrame(() => (getFocusable()[0] ?? container).focus());
    const onFocus = (event: FocusEvent) => { if (!container.contains(event.target as Node)) (getFocusable()[0] ?? container).focus(); };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const elements = getFocusable();
      const first = elements[0] ?? container;
      const last = elements.at(-1) ?? container;
      if (!elements.length || !container.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault(); first.focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === container)) {
        event.preventDefault(); last.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocus);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocus);
      for (const [element, wasInert] of inertNodes) element.inert = wasInert;
      document.body.style.overflow = previousOverflow;
      if (savedTarget?.isConnected) savedTarget.focus({ preventScroll: true });
    };
  }, [containerRef, isActive, onClose, restoreTarget, restoreTargetRef]);
}
