import gsap from "gsap";
import { useQuery } from "@tanstack/react-query";
import { useLayoutEffect, useRef } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { EditorialText } from "../components/EditorialText";
import { ArrowIcon } from "../components/Icons";
import { ProductCard } from "../components/ProductCard";
import { collectionEditorials } from "../data/collection-editorials";
import { emptyCatalog, useCatalogProducts } from "../hooks/useCatalog";
import { usePageMeta } from "../hooks/usePageMeta";
import { useLocale } from "../context/LocaleContext";
import { filterCatalog } from "../lib/catalog-filter";
import { responsiveImage } from "../lib/images";
import { supabase } from "../lib/supabase";

const genderCategories = {
  men: ["sale", "new-in", "tops", "bottoms", "outerwear", "tailoring", "accessories", "footwear", "all"],
  women: ["sale", "new-in", "dresses", "tops", "bottoms", "outerwear", "accessories", "footwear", "all"]
} as const;
const categoryLabels: Record<string, string> = { sale: "Sale", "new-in": "New in", tops: "Tops", bottoms: "Bottoms", outerwear: "Outerwear", tailoring: "Tailoring", dresses: "Dresses", accessories: "Accessories", footwear: "Footwear", all: "All pieces", sneakers: "Sneakers", boots: "Boots", pumps: "Pumps", loafers: "Loafers", "ballet-flats": "Ballet flats", mules: "Mules", slippers: "Slippers", "derby-oxford-shoes": "Derby & Oxford shoes", sandals: "Sandals", "slides-flip-flops": "Slides & flip-flops", espadrilles: "Espadrilles", sunglasses: "Sunglasses", belts: "Belts", "hats-caps": "Hats & caps", "wallets-cardholders": "Wallets & cardholders", scarves: "Scarves", "glasses-frames": "Glasses & frames", "hair-accessories": "Hair accessories", gloves: "Gloves", jewellery: "Jewellery", "fashion-jewellery": "All fashion jewellery", bracelets: "Bracelets", earrings: "Earrings", necklaces: "Necklaces", rings: "Rings", watches: "Watches", "fine-jewellery": "All fine jewellery", "demi-fine-jewellery": "All demi-fine jewellery", "fine-bracelets": "Fine bracelets", "fine-earrings": "Fine earrings", "fine-necklaces": "Fine necklaces", "fine-rings": "Fine rings", "fine-watches": "Fine watches" };

const catalogDirectories = {
  shoes: {
    title: "Shoes",
    intro: "Everyday foundations and statement pairs, selected across shape, finish, and wearability.",
    groups: [{ title: "Shoes", links: [
      ["All shoes", "/collections/shoes?category=all"],
      ["Sneakers", "/collections/shoes?category=sneakers"],
      ["Boots", "/collections/shoes?category=boots"],
      ["Pumps", "/collections/shoes?category=pumps"],
      ["Loafers", "/collections/shoes?category=loafers"],
      ["Ballet flats", "/collections/shoes?category=ballet-flats"],
      ["Mules", "/collections/shoes?category=mules"],
      ["Slippers", "/collections/shoes?category=slippers"],
      ["Derby & Oxford shoes", "/collections/shoes?category=derby-oxford-shoes"],
      ["Sandals", "/collections/shoes?category=sandals"],
      ["Slides & flip-flops", "/collections/shoes?category=slides-flip-flops"],
      ["Espadrilles", "/collections/shoes?category=espadrilles"]
    ] }]
  },
  accessories: {
    title: "Accessories",
    intro: "The finishing pieces: considered, useful, and sourced with the same care as the main look.",
    groups: [{ title: "Accessories", links: [
      ["All accessories", "/collections/accessories?category=all"],
      ["Sunglasses", "/collections/accessories?category=sunglasses"],
      ["Belts", "/collections/accessories?category=belts"],
      ["Hats & caps", "/collections/accessories?category=hats-caps"],
      ["Wallets & cardholders", "/collections/accessories?category=wallets-cardholders"],
      ["Scarves", "/collections/accessories?category=scarves"],
      ["Glasses & frames", "/collections/accessories?category=glasses-frames"],
      ["Hair accessories", "/collections/accessories?category=hair-accessories"],
      ["Gloves", "/collections/accessories?category=gloves"],
      ["Jewellery", "/collections/jewellery"]
    ] }]
  },
  jewellery: {
    title: "Jewellery",
    intro: "Fashion, demi-fine, and fine pieces selected for material, finish, and lasting relevance.",
    groups: [
      { title: "Fashion jewellery", links: [["All fashion jewellery", "/collections/jewellery?category=fashion-jewellery"], ["Bracelets", "/collections/jewellery?category=bracelets"], ["Earrings", "/collections/jewellery?category=earrings"], ["Necklaces", "/collections/jewellery?category=necklaces"], ["Rings", "/collections/jewellery?category=rings"], ["Watches", "/collections/jewellery?category=watches"]] },
      { title: "Fine jewellery", links: [["All fine jewellery", "/collections/jewellery?category=fine-jewellery"], ["All demi-fine jewellery", "/collections/jewellery?category=demi-fine-jewellery"], ["Fine bracelets", "/collections/jewellery?category=fine-bracelets"], ["Fine earrings", "/collections/jewellery?category=fine-earrings"], ["Fine necklaces", "/collections/jewellery?category=fine-necklaces"], ["Fine rings", "/collections/jewellery?category=fine-rings"], ["Fine watches", "/collections/jewellery?category=fine-watches"]] }
    ]
  }
} as const;

function CatalogDirectory({ directory, backTo }: { directory: (typeof catalogDirectories)[keyof typeof catalogDirectories]; backTo?: string }) {
  return <main className="catalog-directory">
    <header><div>{backTo && <Link className="catalog-directory-back" to={backTo}><ArrowIcon /> Back to accessories</Link>}<h1><EditorialText text={directory.title} /></h1></div><p>{directory.intro}</p></header>
    <div className="catalog-directory-groups">{directory.groups.map((group) => <section key={group.title}><h2>{group.title}</h2><nav aria-label={group.title}>{group.links.map(([label, href]) => <Link key={href} to={href}><span>{label}</span><ArrowIcon /></Link>)}</nav></section>)}</div>
  </main>;
}

export function CollectionPage() {
  const { t } = useLocale();
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const heroRef = useRef<HTMLElement>(null);
  const filterDialogRef = useRef<HTMLDialogElement>(null);
  const { data: products = emptyCatalog, isLoading, error, refetch } = useCatalogProducts();
  const collection = useQuery({ queryKey: ["catalog", "collection", slug], enabled: Boolean(slug && supabase), queryFn: async () => {
    const { data, error: queryError } = await supabase!.from("collections").select("name,intro,hero_image_url,hero_image_alt,seo_title,seo_description").eq("slug", slug!).eq("is_active", true).maybeSingle();
    if (queryError) throw queryError;
    return data;
  } });
  const title = collection.data?.name ?? (slug ? slug === "luxury" ? "Luxury sourcing" : slug.replaceAll("-", " ") : "All products");
  const brand = params.get("brand") || "";
  const size = params.get("size") || "";
  const sort = params.get("sort") || "featured";
  const subcategory = params.get("category") || "";
  const gender = slug === "men" || slug === "women" ? slug : null;
  const visibleProducts = filterCatalog(products, { ...(slug ? { collection: slug } : {}), subcategory, brand, size, sort });
  const brands = [...new Set(products.map((product) => product.brand))].sort();
  const sizes = [...new Set(products.flatMap((product) => product.variants.flatMap((variant) => variant.size ? [variant.size] : [])))];
  const update = (key: string, value: string) => setParams((current) => { const next = new URLSearchParams(current); if (value) next.set(key, value); else next.delete(key); return next; });
  usePageMeta({ title: collection.data?.seo_title ?? `${title} | Fieldio`, description: collection.data?.seo_description ?? `Explore ${title.toLowerCase()} through the Fieldio fashion edit and personal shopping service.`, canonical: `https://fieldio.shop/collections${slug ? `/${slug}` : ""}` });
  const intro = collection.data?.intro || (slug === "luxury" ? "Tell us the piece. Fieldio handles the search, confirmation, and worldwide delivery." : "A considered edit. Final availability and shipping are confirmed personally.");
  const editorial = collectionEditorials[slug ?? "all"] ?? collectionEditorials.all!;
  const heroImage = collection.data?.hero_image_url || editorial.image;
  const heroImageAlt = collection.data?.hero_image_alt || editorial.imageAlt;

  useLayoutEffect(() => {
    const hero = heroRef.current;
    if (!hero || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const image = hero.querySelector(".collection-editorial-media");
    const context = gsap.context(() => {
      gsap.fromTo(image, { clipPath: "inset(0 0 100% 0)", willChange: "clip-path" }, { clipPath: "inset(0 0 0% 0)", duration: 0.78, ease: "power4.inOut", clearProps: "clipPath,willChange" });
    }, hero);
    return () => context.revert();
  }, [slug, heroImage]);

  const directory = catalogDirectories[slug as keyof typeof catalogDirectories];
  if (directory && !subcategory) return <CatalogDirectory directory={directory} {...(slug === "jewellery" ? { backTo: "/collections/accessories" } : {})} />;

  if (gender && !subcategory) return <div className="gender-directory">
    <header><h1>{gender === "men" ? "Men" : "Women"}</h1><p>Choose a category to browse a more focused Fieldio edit.</p></header>
    <nav className="gender-switch" aria-label="Shop by gender"><Link className={gender === "men" ? "active" : ""} to="/collections/men">Men</Link><Link className={gender === "women" ? "active" : ""} to="/collections/women">Women</Link></nav>
    <nav className="gender-category-list" aria-label={`${gender === "men" ? "Men's" : "Women's"} categories`}>
      {genderCategories[gender].map((category) => <Link key={category} className={category === "sale" ? "sale" : ""} to={`/collections/${gender}?category=${category}`}><span>{categoryLabels[category]}</span><span aria-hidden="true">→</span></Link>)}
      <Link className="all-brands" to="/brands"><span>All brands</span><span aria-hidden="true">→</span></Link>
    </nav>
  </div>;

  return <div className="collection-page">
    <header ref={heroRef} className={`collection-editorial collection-editorial--${editorial.layout}`}>
      <div className="collection-editorial-copy"><h1><EditorialText text={subcategory ? `${title} / ${categoryLabels[subcategory] ?? subcategory.replaceAll("-", " ")}` : title} /></h1><p>{collection.data?.intro || editorial.statement || intro}</p>{gender && <Link className="text-link" to={`/collections/${gender}`}>Browse {gender} categories</Link>}</div>
      <div className="collection-editorial-media"><img {...responsiveImage(heroImage)} sizes="(max-width: 760px) 100vw, 62vw" alt={heroImageAlt} /></div>
    </header>
    <div className="mobile-filter-bar"><p aria-live="polite">{visibleProducts.length} {visibleProducts.length === 1 ? t("collection.piece") : t("collection.pieces")}{brand || size ? ` · ${[brand, size].filter(Boolean).join(" · ")}` : ""}</p><button type="button" className="secondary-button" onClick={() => filterDialogRef.current?.showModal()}>{t("collection.filter")}</button></div>
    <dialog ref={filterDialogRef} className="filter-sheet" aria-labelledby="filter-sheet-title"><div className="filter-sheet-heading"><h2 id="filter-sheet-title">{t("collection.filterTitle")}</h2><button type="button" className="text-link" onClick={() => filterDialogRef.current?.close()}>{t("common.close")}</button></div><div className="filter-sheet-fields"><label>{t("collection.brand")}<select value={brand} onChange={(e) => update("brand", e.target.value)}><option value="">{t("collection.allBrands")}</option>{brands.map((value) => <option key={value}>{value}</option>)}</select></label><label>{t("collection.size")}<select value={size} onChange={(e) => update("size", e.target.value)}><option value="">{t("collection.allSizes")}</option>{sizes.map((value) => <option key={value}>{value}</option>)}</select></label><label>{t("collection.sort")}<select value={sort} onChange={(e) => update("sort", e.target.value)}><option value="featured">{t("collection.featured")}</option><option value="name">{t("collection.name")}</option><option value="price-low">{t("collection.low")}</option><option value="price-high">{t("collection.high")}</option></select></label></div><div className="filter-sheet-actions">{(brand || size) && <button className="text-link" onClick={() => setParams({ sort })}>{t("collection.clear")}</button>}<button className="primary-button" type="button" onClick={() => filterDialogRef.current?.close()}>View {visibleProducts.length} {visibleProducts.length === 1 ? t("collection.piece") : t("collection.pieces")}</button></div></dialog>
    <div className="collection-filters collection-filters-desktop"><label>{t("collection.brand")}<select value={brand} onChange={(e) => update("brand", e.target.value)}><option value="">{t("collection.allBrands")}</option>{brands.map((value) => <option key={value}>{value}</option>)}</select></label><label>{t("collection.size")}<select value={size} onChange={(e) => update("size", e.target.value)}><option value="">{t("collection.allSizes")}</option>{sizes.map((value) => <option key={value}>{value}</option>)}</select></label><label>{t("collection.sort")}<select value={sort} onChange={(e) => update("sort", e.target.value)}><option value="featured">{t("collection.featured")}</option><option value="name">{t("collection.name")}</option><option value="price-low">{t("collection.low")}</option><option value="price-high">{t("collection.high")}</option></select></label>{(brand || size) && <button className="text-link" onClick={() => setParams({ sort })}>{t("collection.clear")}</button>}<p aria-live="polite">{visibleProducts.length} {visibleProducts.length === 1 ? t("collection.piece") : t("collection.pieces")}</p></div>
    {error ? <div className="empty-state" role="alert"><h2>The edit could not load.</h2><button className="primary-button" onClick={() => void refetch()}>Try again</button></div> : isLoading ? <div className="product-grid">{Array.from({ length: 4 }).map((_, index) => <div className="product-skeleton" key={index} />)}</div> : visibleProducts.length ? <section className="product-grid"><h2 className="sr-only">Products</h2>{visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)}</section> : <div className="empty-state"><h2>No pieces in this edit yet.</h2><p>Adjust your filters or ask a Fieldio personal shopper to source something specific.</p><div className="empty-actions">{(brand || size) && <button className="text-link" onClick={() => setParams({ sort })}>Clear filters</button>}<Link className="primary-button" to="/personal-shopping">Ask a personal shopper</Link></div></div>}
  </div>;
}
