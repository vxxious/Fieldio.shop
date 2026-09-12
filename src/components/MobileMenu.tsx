import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRef, type RefObject } from "react";
import { NavLink } from "react-router-dom";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useLocale } from "../context/LocaleContext";
import { ChevronIcon, CloseIcon, InstagramIcon } from "./Icons";
import { Wordmark } from "./Wordmark";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRegion: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}

const links = [
  ["nav.new", "/collections/new-arrivals"],
  ["nav.luxury", "/collections/luxury"],
  ["nav.women", "/collections/women"],
  ["nav.men", "/collections/men"],
  ["nav.bags", "/collections/bags"],
  ["nav.shoes", "/collections/shoes"],
  ["nav.personal", "/personal-shopping"],
  ["nav.wholesale", "/wholesale"]
] as const;

export function MobileMenu({ isOpen, onClose, onOpenRegion, triggerRef }: MobileMenuProps) {
  const panelRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { region, t } = useLocale();
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
              <button className="icon-button" type="button" onClick={onClose} aria-label={t("nav.closeMenu")}><CloseIcon /></button>
            </div>
            <div className="mobile-menu-links">
              {links.map(([label, href], index) => (
                <motion.div key={href} initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduceMotion ? 0 : 0.08 + index * 0.035 }}>
                  <NavLink to={href} onClick={onClose}>{t(label)}</NavLink>
                </motion.div>
              ))}
            </div>
            <div className="mobile-menu-footer">
              <div className="mobile-utility-links"><NavLink to="/account" onClick={onClose}>{t("nav.account")}</NavLink><NavLink to="/wishlist" onClick={onClose}>{t("nav.wishlist")}</NavLink><NavLink to="/contact" onClick={onClose}>{t("nav.contact")}</NavLink></div>
              <div className="mobile-menu-footer-bar">
                <button className="mobile-menu-region" type="button" onClick={onOpenRegion} aria-label={`${t("region.open")}: ${region.code}, ${region.currency}`} aria-haspopup="dialog">
                  <span>{region.code}</span>
                  <span>{region.currency}</span>
                  <ChevronIcon />
                </button>
                <a className="mobile-menu-instagram" href="https://www.instagram.com/fieldio_wrd/" target="_blank" rel="noreferrer" onClick={onClose} aria-label="Fieldio on Instagram">
                  <InstagramIcon />
                  <span>Instagram</span>
                </a>
              </div>
            </div>
          </motion.nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
