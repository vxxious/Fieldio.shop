import { Link } from "react-router-dom";
import { brands, getBrandSlug } from "../data/catalog";
import { usePageMeta } from "../hooks/usePageMeta";
import { emptyCatalog, useCatalogProducts } from "../hooks/useCatalog";
import { createWhatsAppUrl } from "../lib/whatsapp";
import { ArrowIcon } from "../components/Icons";
import { ProductCard } from "../components/ProductCard";
import { Reveal } from "../components/Reveal";
import { responsiveImage } from "../lib/images";
import { useEditorial } from "../hooks/useEditorial";
import { EditorialText } from "../components/EditorialText";
import { Button } from "../components/ui/button";

const categories = ["All", "Women", "Men", "Bags", "Shoes"];
const featuredBrands = brands.filter((brand) => brand !== "Fieldio Edit").slice(0, 5);

export function HomePage() {
  const { data: catalog = emptyCatalog, isLoading, error } = useCatalogProducts();
  const { data: editorial = {} } = useEditorial("home");
  usePageMeta({ title: "Fieldio — Everything fashion", description: "Luxury sourcing, personal shopping, selected fashion, and worldwide shipment through Fieldio.", canonical: "https://fieldio.shop/" });

  return (
    <>
      <section className="catalog-intro" aria-labelledby="catalog-title">
        <div className="catalog-copy">
          <h1 id="catalog-title"><EditorialText text={editorial.intro?.heading || "The Fieldio edit"} /></h1>
          <p>{editorial.intro?.body || "New arrivals, exceptional pieces, and personal sourcing across the brands you want."}</p>
        </div>
        <div className="catalog-controls">
          <nav aria-label="Product categories">{categories.map((category, index) => <Link key={category} className={index === 0 ? "active" : ""} to={category === "All" ? "/collections" : `/collections/${category.toLowerCase()}`}>{category}</Link>)}</nav>
          <div><Link to="/collections?sort=name">Sort by</Link><Link to="/collections?filters=open">Filter</Link></div>
        </div>
      </section>

      {error && <div className="catalog-notice" role="alert">The live catalog could not load. Refresh the page or ask Fieldio on WhatsApp.</div>}
      {!isLoading && !error && !catalog.length && <div className="empty-state"><h2>Your next piece, personally sourced.</h2><p>The online edit is being prepared. Tell Fieldio what you are looking for.</p><Link to="/personal-shopping" className="text-link">Speak to a personal shopper</Link></div>}
      {isLoading ? <div className="product-grid home-grid" aria-label="Loading products">{Array.from({ length: 4 }).map((_, index) => <div className="product-skeleton" key={index} />)}</div> : <section className="product-grid home-grid" aria-label="Featured products">{catalog.slice(0, 4).map((product, index) => <ProductCard key={product.id} product={product} priority={index < 4} />)}</section>}

      <Reveal className="account-bulletin-reveal">
        <section className="account-bulletin" aria-labelledby="account-bulletin-title">
          <div>
            <h2 id="account-bulletin-title">Keep your edit close.</h2>
            <p>Create an account to save your wishlist, details, and order requests, ready whenever you return.</p>
          </div>
          <div className="account-bulletin-actions">
            <Button asChild size="lg" className="primary-button"><Link to="/account?mode=signup">Create account</Link></Button>
            <Link to="/account" className="text-link">Already have an account? Sign in</Link>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="brand-ledger" aria-labelledby="brands-title">
          <div className="brand-ledger-copy">
            <h2 id="brands-title"><EditorialText text="A worldwide luxury desk" /></h2>
            <p>From a specific Louis Vuitton piece to a hard-to-find runway size, Fieldio makes the search personal. Send the reference; we return with availability, condition, final price, and shipping options.</p>
            <a href={createWhatsAppUrl("Hello Fieldio, I would like help sourcing a luxury item.")} target="_blank" rel="noreferrer" className="arrow-link">Start a sourcing request <ArrowIcon /></a>
          </div>
          <div className="brand-list" aria-label="Brands available for sourcing">
            {featuredBrands.map((brand) => <Link key={brand} to={`/brands/${getBrandSlug(brand)}`}><span>{brand}</span><ArrowIcon /></Link>)}
            <Link className="brand-list-more" to="/brands"><span>View all brands</span><ArrowIcon /></Link>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="campaign-panel">
          <img {...responsiveImage(editorial.campaign?.image || "/images/outerwear-collection.png")} sizes="100vw" alt={editorial.campaign?.imageAlt || "Three women walking through a concrete gallery in modern neutral outerwear"} loading="lazy" />
          <div className="campaign-copy">
            <h2><EditorialText text={editorial.campaign?.heading || "Modern essentials. Chosen with purpose."} /></h2>
            <p>Women, men, accessories, and luxury sourcing—one considered edit, delivered worldwide.</p>
            <Button asChild size="lg" className="light-button"><Link to="/collections/new-arrivals">View new arrivals</Link></Button>
          </div>
        </section>
      </Reveal>

      <section className="product-grid secondary-grid" aria-label="More from the edit">
        {catalog.slice(4).map((product) => <ProductCard key={product.id} product={product} />)}
      </section>

      <Reveal>
        <section className="personal-shopping-home">
          <div className="service-image"><img {...responsiveImage("/images/luxury-travel.png")} sizes="(max-width: 700px) 100vw, 60vw" alt="Leather travel goods arranged in warm studio light" loading="lazy" /></div>
          <div className="service-copy">
            <h2><EditorialText text="Your personal shopper, wherever you are." /></h2>
            <p>Share a product link, screenshot, name, or brief. Fieldio sources across luxury, sportswear, accessories, and everyday fashion, then coordinates worldwide delivery.</p>
            <div><Button asChild size="lg" className="primary-button"><Link to="/personal-shopping">How it works</Link></Button><a href={createWhatsAppUrl("Hello Fieldio, I would like to speak with a personal shopper.")} target="_blank" rel="noreferrer" className="text-link">Chat on WhatsApp</a></div>
          </div>
        </section>
      </Reveal>
    </>
  );
}
