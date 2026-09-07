import { useEffect } from "react";

interface PageMeta {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
}

function setMeta(name: string, content: string): void {
  let element = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.name = name;
    document.head.appendChild(element);
  }
  element.content = content;
}

export function usePageMeta({ title, description, canonical, image = "https://fieldio.shop/images/fieldio-hero.png" }: PageMeta): void {
  useEffect(() => {
    document.title = title;
    setMeta("description", description);
    for (const [property, content] of Object.entries({ "og:title": title, "og:description": description, "og:url": canonical ?? window.location.href, "og:image": image, "og:site_name": "Fieldio" })) {
      let element = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
      if (!element) { element = document.createElement("meta"); element.setAttribute("property", property); document.head.appendChild(element); }
      element.content = content;
    }
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);
    setMeta("twitter:image", image);
    setMeta("robots", /^\/(account|admin|checkout|wishlist)(\/|$)/.test(window.location.pathname) ? "noindex,nofollow" : "index,follow");
    const canonicalElement = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonicalElement && canonical) canonicalElement.href = canonical;
  }, [canonical, description, image, title]);
}
