import { useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { selectCartCount, useCartStore } from "../store/cart";
import { useWishlistStore } from "../store/wishlist";
import { AccountIcon, BagIcon, MenuIcon, SearchIcon } from "./Icons";
import { MobileMenu } from "./MobileMenu";
import { ThemeToggle } from "./ThemeToggle";
import { Wordmark } from "./Wordmark";

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const count = useCartStore(selectCartCount);
  const openCart = useCartStore((state) => state.openCart);
  const wishlistCount = useWishlistStore((state) => state.productIds.length);

  return (
    <>
      <div className="announcement">Worldwide sourcing & shipment <span>Personal shopping on WhatsApp</span></div>
      <header className="site-header">
        <div className="header-left">
          <button ref={menuButtonRef} className="icon-button menu-button mobile-only" type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen}><MenuIcon /></button>
          <Link to="/search" className="icon-button mobile-only mobile-search-button" aria-label="Search"><SearchIcon /></Link>
          <nav className="desktop-nav" aria-label="Primary">
            <NavLink to="/collections">Shop</NavLink>
            <NavLink to="/collections/luxury">Luxury</NavLink>
            <NavLink to="/personal-shopping">Personal shopping</NavLink>
          </nav>
        </div>
        <Wordmark />
        <nav className="header-actions" aria-label="Utilities">
          <Link to="/account" className="desktop-only">Account</Link>
          <Link to="/wishlist" className="desktop-only">Wishlist {wishlistCount > 0 && `(${wishlistCount})`}</Link>
          <ThemeToggle />
          <Link to="/search" className="icon-button desktop-only" aria-label="Search"><SearchIcon /></Link>
          <button className="bag-button" type="button" onClick={(event) => openCart(event.currentTarget)} aria-label={`Open bag, ${count} items`} aria-haspopup="dialog">
            <BagIcon /><span className="desktop-only">Bag</span>{count > 0 && <span>({count})</span>}
          </button>
          <Link to="/account" className="icon-button mobile-only mobile-account-button" aria-label="Account"><AccountIcon /></Link>
        </nav>
      </header>
      <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} triggerRef={menuButtonRef} />
    </>
  );
}
