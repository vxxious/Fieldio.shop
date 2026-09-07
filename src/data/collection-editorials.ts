export type CollectionHeroLayout = "split" | "cinematic" | "index" | "reverse";

export interface CollectionEditorial {
  image: string;
  imageAlt: string;
  statement: string;
  layout: CollectionHeroLayout;
}

export const collectionEditorials: Record<string, CollectionEditorial> = {
  "new-arrivals": {
    image: "/images/outerwear-collection.png",
    imageAlt: "Models moving through a concrete gallery in a modern outerwear edit",
    statement: "The latest silhouettes, materials, and sourcing references selected by Fieldio.",
    layout: "index"
  },
  luxury: {
    image: "/images/luxury-travel.png",
    imageAlt: "Unbranded leather travel pieces arranged in a limestone studio",
    statement: "Send the reference. Fieldio confirms the piece, condition, final price, and worldwide delivery personally.",
    layout: "cinematic"
  },
  women: {
    image: "/images/olive-silk-look.png",
    imageAlt: "Model in an olive silk blouse and wide ivory trousers",
    statement: "Fluid tailoring, considered occasionwear, and pieces sourced around the way you dress.",
    layout: "split"
  },
  men: {
    image: "/images/taupe-menswear.png",
    imageAlt: "Model wearing a taupe overshirt with charcoal trousers",
    statement: "Quiet structure and modern proportions across everyday and luxury menswear.",
    layout: "reverse"
  },
  bags: {
    image: "/images/oxblood-accessories.png",
    imageAlt: "Oxblood structured bag arranged with ivory accessories",
    statement: "Structured icons, modern utility, and personal sourcing without the noise.",
    layout: "cinematic"
  },
  shoes: {
    image: "/images/oxblood-accessories.png",
    imageAlt: "Ivory sculptural slingback shoes on a stone plinth",
    statement: "Footwear selected by silhouette, finish, and the size you actually need.",
    layout: "reverse"
  },
  all: {
    image: "/images/fieldio-hero.png",
    imageAlt: "Fieldio fashion edit in a restrained editorial studio",
    statement: "Women, men, bags, shoes, and worldwide personal sourcing in one considered edit.",
    layout: "index"
  }
};
