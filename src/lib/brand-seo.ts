export function brandSeo(name: string, description?: string | null, seoTitle?: string | null, seoDescription?: string | null) {
  return {
    title: seoTitle || `${name} at Fieldio | Designer Fashion & Personal Shopping`,
    description: seoDescription || (description && description !== "Fieldio personal sourcing selection." ? description : `Explore ${name} pieces on Fieldio. Browse available listings or request a specific item through our personal shopping service.`)
  };
}
