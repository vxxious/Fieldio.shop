import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRef, type RefObject } from "react";
import { NavLink } from "react-router-dom";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { CloseIcon } from "./Icons";
import { Wordmark } from "./Wordmark";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}

const links = [
  ["New arrivals", "/collections/new-arrivals"],
  ["Luxury sourcing", "/collections/luxury"],
  ["Women", "/collections/women"],
  ["Men", "/collections/men"],
  ["Bags", "/collections/bags"],
  ["Shoes", "/collections/shoes"],
  ["Personal shopping", "/personal-shopping"],
  ["Wholesale", "/wholesale"]
] as const;

export function MobileMenu({ isOpen, onClose, triggerRef }: MobileMenuProps) {
  const panelRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  useFocusTrap(panelRef, isOpen, onClose, null, triggerRef, panelRef);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="mobile-menu-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.2 }}>
          <motion.nav
            ref={panelRef}
            className="mobile-menu-panel"
            data-lenis-prevent
            aria-label="Mobile navigation"
            aria-modal="true"
            role="dialog"
            tabIndex={-1}
            initial={reduceMotion ? false : { y: "-5%", clipPath: "inset(0 0 100% 0)" }}
            animate={{ y: 0, clipPath: "inset(0 0 0% 0)" }}
            exit={reduceMotion ? { opacity: 0 } : { y: "-3%", clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: reduceMotion ? 0 : 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mobile-menu-top">
              <Wordmark />
              <button className="icon-button" type="button" onClick={onClose} aria-label="Close menu"><CloseIcon /></button>
            </div>
            <div className="mobile-menu-links">
              {links.map(([label, href], index) => (
                <motion.div key={href} initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduceMotion ? 0 : 0.08 + index * 0.035 }}>
                  <NavLink to={href} onClick={onClose}>{label}</NavLink>
                </motion.div>
              ))}
            </div>
            <div className="mobile-menu-footer">
              <div className="mobile-utility-links"><NavLink to="/account" onClick={onClose}>Account</NavLink><NavLink to="/wishlist" onClick={onClose}>Wishlist</NavLink><NavLink to="/contact" onClick={onClose}>Contact</NavLink></div>
            </div>
          </motion.nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
