import { Link } from "react-router-dom";
import { usePageMeta } from "../hooks/usePageMeta";
import { useDiscoveryProducts } from "../hooks/useDiscoveryProducts";
import { products as previewProducts } from "../data/catalog";
import { catalogPreview } from "../lib/config";
import { createWhatsAppUrl } from "../lib/whatsapp";
import { ArrowIcon } from "../components/Icons";
import { ProductCard } from "../components/ProductCard";
import { Reveal } from "../components/Reveal";
import { responsiveImage } from "../lib/images";
import { useEditorial } from "../hooks/useEditorial";
import { EditorialText } from "../components/EditorialText";
import { Button } from "../components/ui/button";
import { useLocale } from "../context/LocaleContext";
import { discoveryEmpty } from "../lib/discovery-empty";

const categories = [["All", "nav.all"], ["Women", "nav.women"], ["Men", "nav.men"]] as const;
const editCategories = [
  ["Men", "/collections/men"],
  ["Women", "/collections/women"],
  ["Shoes", "/collections/shoes"],
  ["Bags", "/collections/bags"],
  ["Brands", "/brands"]
] as const;

export function HomePage() {
  const { t } = useLocale();
  const featured = useDiscoveryProducts({ kind: "all", limit: 4 });
  const newIn = useDiscoveryProducts({ kind: "new", limit: 8 });
  const sale = useDiscoveryProducts({ kind: "sale", limit: 8 });
  const { data: editorial = {} } = useEditorial("home");
  const homeCatalog = catalogPreview ? previewProducts.slice(0, 4) : featured.data?.products ?? [];
  const isLoading = !catalogPreview && featured.isPending;
  const error = featured.error;
  const hasNewIn = Boolean(newIn.data?.products.length);
  usePageMeta({ title: "Fieldio Shop | Designer Fashion & Personal Shopping", description: "Fieldio is an independent designer fashion marketplace and personal shopping service for clothing, footwear, and accessories, with worldwide sourcing and delivery support.", canonical: "https://fieldio.shop/" });

  return (
    <>
      <section className="catalog-intro" aria-labelledby="catalog-title">
        <div className="home-hero-composition">
          <div className="home-hero-copy">
            <p className="home-hero-label">The Fieldio Edit</p>
            <h1 id="catalog-title" aria-label="Designer fashion, personally sourced.">
              <span aria-hidden="true">
                <span className="home-hero-line"><EditorialText text="Designer fashion," /></span>
                <span className="home-hero-line"><EditorialText text="personally sourced." /></span>
              </span>
            </h1>
            <div className="home-hero-details">
              <p>An independent marketplace for designer fashion and personal sourcing, delivered worldwide.</p>
              <Link className="home-hero-cta" to="/collections">Explore the edit <ArrowIcon /></Link>
            </div>
          </div>
          <div className="home-hero-media">
            <picture>
              <source type="image/webp" srcSet="/images/fieldio-mannequin-hero-480.webp 480w, /images/fieldio-mannequin-hero-940.webp 940w" sizes="(max-width: 760px) 94vw, 48vw" />
              <img src="/images/fieldio-mannequin-hero.png" width="941" height="1672" alt="Mannequin wearing a leopard-print cap and fleece with wide-leg denim and brown trainers" loading="eager" fetchPriority="high" />
            </picture>
          </div>
        </div>
        <div className="catalog-controls">
          <nav aria-label="Product categories">{categories.map(([category, label], index) => <Link key={category} className={index === 0 ? "active" : ""} to={category === "All" ? "/collections" : `/collections/${category.toLowerCase()}`}>{t(label)}</Link>)}</nav>
          <div><Link to="/collections?sort=name">{t("collection.sort")}</Link><Link to="/collections?filters=open">{t("collection.filter")}</Link></div>
        </div>
      </section>

      {error && <div className="catalog-notice" role="alert">The live catalog could not load. Refresh the page or ask Fieldio on WhatsApp.</div>}
      {!isLoading && !error && !homeCatalog.length && <div className="empty-state"><h2>Your next piece, personally sourced.</h2><p>The online edit is being prepared. Tell Fieldio what you are looking for.</p><Link to="/personal-shopping" className="text-link">Speak to a personal shopper</Link></div>}
      {isLoading ? <div className="product-grid home-grid" aria-label="Loading products">{Array.from({ length: 4 }).map((_, index) => <div className="product-skeleton" key={index} />)}</div> : <section className="product-grid home-grid" aria-labelledby="home-featured-title"><h2 id="home-featured-title" className="sr-only">Shop the edit</h2>{homeCatalog.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}</section>}

      <Reveal className="account-bulletin-reveal">
        <section className="account-bulletin" aria-labelledby="account-bulletin-title">
          <div>
            <h2 id="account-bulletin-title">{t("home.accountTitle")}</h2>
            <p>{t("home.accountCopy")}</p>
          </div>
          <div className="account-bulletin-actions">
            <Button asChild size="lg" className="primary-button"><Link to="/account?mode=signup">{t("home.createAccount")}</Link></Button>
            <Link to="/account" className="text-link">{t("home.signIn")}</Link>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="brand-ledger" aria-labelledby="brands-title">
          <div className="brand-ledger-copy">
            <h2 id="brands-title"><EditorialText text="Explore the Fieldio edit" /></h2>
            <p>Browse clothing, shoes, and bags across brands and approved sellers. Looking for a specific piece? Fieldio can source it for you.</p>
            <Link to="/collections" className="arrow-link">Browse all pieces <ArrowIcon /></Link>
          </div>
          <div className="brand-list" aria-label="Browse the Fieldio edit">
            {editCategories.map(([label, href]) => <Link key={label} to={href}><span>{label}</span><ArrowIcon /></Link>)}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="campaign-panel">
          <img {...responsiveImage(editorial.campaign?.image || "/images/outerwear-collection.png")} sizes="100vw" alt={editorial.campaign?.imageAlt || "Three women walking through a concrete gallery in modern neutral outerwear"} loading="lazy" />
          <div className="campaign-copy">
            <h2><EditorialText text={editorial.campaign?.heading || t("home.campaignTitle")} /></h2>
            <p>Women, men, accessories, and luxury sourcing—one considered edit, delivered worldwide.</p>
            <Button asChild size="lg" className="light-button"><Link to={hasNewIn ? "/collections/new-arrivals" : "/collections"}>{hasNewIn ? t("home.viewNew") : "Browse all pieces"}</Link></Button>
          </div>
        </section>
      </Reveal>

      {([ ["New in", "new", newIn, "/collections/new-arrivals"], ["Sale", "sale", sale, "/collections/sale"] ] as const).map(([label, kind, query, href]) => <section className="home-discovery" key={label} aria-label={label}>
        <div className="home-discovery-heading"><h2>{label}</h2>{Boolean(query.data?.products.length) && <Link className="arrow-link" to={href}>View all <ArrowIcon /></Link>}</div>
        {query.error ? <div className="catalog-notice" role="alert">{label} could not load. <button className="text-link" onClick={() => void query.refetch()}>Try again</button></div>
          : query.isPending ? <div className="product-grid" aria-label={`Loading ${label.toLowerCase()}`}>{Array.from({ length: 4 }).map((_, index) => <div className="product-skeleton" key={index} />)}</div>
          : query.data?.products.length ? <div className="product-grid">{query.data.products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
          : <div className="home-discovery-empty"><p>{discoveryEmpty[kind].title} {discoveryEmpty[kind].description}</p><div className="empty-actions"><Link className="arrow-link" to="/collections">Browse all pieces <ArrowIcon /></Link><Link className="text-link" to="/personal-shopping">Ask a personal shopper</Link></div></div>}
      </section>)}

      <Reveal>
        <section className="personal-shopping-home">
          <div className="service-image"><img {...responsiveImage("/images/luxury-travel.png")} sizes="(max-width: 700px) 100vw, 60vw" alt="Leather travel goods arranged in warm studio light" loading="lazy" /></div>
          <div className="service-copy">
            <h2><EditorialText text={t("home.personalTitle")} /></h2>
            <p>Share a product link, screenshot, name, or brief. Fieldio sources across luxury, sportswear, accessories, and everyday fashion, then coordinates worldwide delivery.</p>
            <div><Button asChild size="lg" className="primary-button"><Link to="/how-it-works">{t("home.howItWorks")}</Link></Button><a href={createWhatsAppUrl("Hello Fieldio, I would like to speak with a personal shopper.")} target="_blank" rel="noreferrer" className="text-link">{t("home.chat")}</a></div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="vendor-callout" aria-labelledby="vendor-callout-title">
          <div><h2 id="vendor-callout-title">Sell with Fieldio.</h2><p>Independent boutiques, collectors, and trusted vendors can submit authentic fashion for review. Create an account, choose “I want to sell,” and tell us what you supply.</p></div>
          <Button asChild size="lg" className="primary-button"><Link to="/sell">Create a seller account</Link></Button>
        </section>
      </Reveal>
    </>
  );
}
