import { Link } from "react-router-dom";
import { Newsletter } from "./Newsletter";
import { InstagramIcon } from "./Icons";

export function SiteFooter() {
  return (
    <footer>
      <Newsletter />
      <div className="site-footer">
        <div className="footer-brand">
          <Link to="/" aria-label="Fieldio home">Fieldio</Link>
          <p>Everything fashion.<br />Worldwide shipment.</p>
        </div>
        <div className="footer-links">
          <div><h3>Shop</h3><Link to="/collections/new-arrivals">New arrivals</Link><Link to="/collections/luxury">Luxury sourcing</Link><Link to="/collections/men">Men</Link><Link to="/collections/women">Women</Link></div>
          <div><h3>Services</h3><Link to="/personal-shopping">Personal shopping</Link><Link to="/wholesale">Wholesale</Link><Link to="/contact">Contact</Link><Link to="/about">About</Link></div>
          <div><h3>Information</h3><Link to="/shipping">Shipping</Link><Link to="/returns">Returns</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></div>
        </div>
        <div className="footer-meta">
          <a href="https://www.instagram.com/fieldio_wrd/" target="_blank" rel="noreferrer"><InstagramIcon /> @fieldio_wrd</a>
          <span>© {new Date().getFullYear()} Fieldio</span>
        </div>
      </div>
    </footer>
  );
}
