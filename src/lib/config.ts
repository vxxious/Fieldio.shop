export const catalogPreview = !import.meta.env.VITE_SUPABASE_URL && (import.meta.env.DEV || import.meta.env.VITE_CATALOG_PREVIEW === "true");
export const appUrl = (import.meta.env.VITE_APP_URL || "https://fieldio.shop").replace(/\/$/, "");
