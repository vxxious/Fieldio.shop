import { useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useLocale } from "../context/LocaleContext";
import { selectCartCount, useCartStore } from "../store/cart";
import { useWishlistStore } from "../store/wishlist";
import { AccountIcon, BagIcon, MenuIcon, SearchIcon } from "./Icons";
import { MobileMenu } from "./MobileMenu";
import { RegionLanguagePanel } from "./RegionLanguagePanel";
import { ThemeToggle } from "./ThemeToggle";
import { Wordmark } from "./Wordmark";

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const regionTriggerRef = useRef<HTMLButtonElement>(null);
  const { region, t } = useLocale();
  const count = useCartStore(selectCartCount);
  const openCart = useCartStore((state) => state.openCart);
  const wishlistCount = useWishlistStore((state) => state.productIds.length);

  const openRegionFromMenu = () => {
    setMenuOpen(false);
    regionTriggerRef.current = menuButtonRef.current;
    window.setTimeout(() => setRegionOpen(true), 0);
  };

  return (
    <>
      <div className="announcement">
        <span className="announcement-copy">{t("announcement.shipping")}</span>
        <span>{t("announcement.whatsapp")}</span>
        <button
          className="region-trigger"
          type="button"
          onClick={(event) => {
            regionTriggerRef.current = event.currentTarget;
            setRegionOpen(true);
          }}
          aria-label={t("region.open")}
          aria-haspopup="dialog"
          aria-expanded={regionOpen}
        >
          <span>{region.code}</span>
          <span className="region-trigger-currency"> · {region.currency}</span>
        </button>
      </div>
      <header className="site-header">
        <div className="header-left">
          <button ref={menuButtonRef} className="icon-button menu-button mobile-only" type="button" onClick={() => setMenuOpen(true)} aria-label={t("nav.openMenu")} aria-expanded={menuOpen}><MenuIcon /></button>
          <Link to="/search" className="icon-button mobile-only mobile-search-button" aria-label={t("nav.search")}><SearchIcon /></Link>
          <nav className="desktop-nav" aria-label="Primary">
            <NavLink to="/collections">{t("nav.shop")}</NavLink>
            <NavLink to="/collections/luxury">{t("nav.luxury")}</NavLink>
            <NavLink to="/personal-shopping">{t("nav.personal")}</NavLink>
          </nav>
        </div>
        <Wordmark />
        <nav className="header-actions" aria-label="Utilities">
          <Link to="/account" className="desktop-only">{t("nav.account")}</Link>
          <Link to="/wishlist" className="desktop-only">{t("nav.wishlist")} {wishlistCount > 0 && `(${wishlistCount})`}</Link>
          <ThemeToggle />
          <Link to="/search" className="icon-button desktop-only" aria-label={t("nav.search")}><SearchIcon /></Link>
          <Link to="/account" className="icon-button mobile-only mobile-account-button" aria-label={t("nav.account")}><AccountIcon /></Link>
          <button className="bag-button" type="button" onClick={(event) => openCart(event.currentTarget)} aria-label={`${t("nav.openBag")}, ${count} ${t("nav.items")}`} aria-haspopup="dialog">
            <BagIcon /><span className="desktop-only">{t("nav.bag")}</span>{count > 0 && <span>({count})</span>}
          </button>
        </nav>
      </header>
      <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} onOpenRegion={openRegionFromMenu} triggerRef={menuButtonRef} />
      <RegionLanguagePanel isOpen={regionOpen} onClose={() => setRegionOpen(false)} triggerRef={regionTriggerRef} />
    </>
  );
}
