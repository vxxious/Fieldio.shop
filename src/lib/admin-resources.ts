import { z } from "zod";

export interface AdminField {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "money" | "boolean" | "uuid" | "datetime-local" | "url" | "tags" | "json";
  required?: boolean;
  options?: string[];
}
export type AdminRole = "owner" | "admin" | "editor" | "fulfilment";
export interface AdminResource { table: string; title: string; roles: AdminRole[]; key?: string; fields: AdminField[]; columns: string[]; readOnly?: boolean; noCreate?: boolean; }
const field = (key: string, label: string, type: AdminField["type"] = "text", required = false): AdminField => ({ key, label, type, required });
const namedFields = [field("name", "Name", "text", true), field("slug", "URL slug", "text", true)];
const reference = (key: string, label: string, required = false) => field(key, label, "uuid", required);
const catalogRoles: AdminRole[] = ["owner", "admin", "editor"];
const managementRoles: AdminRole[] = ["owner", "admin"];
const fulfilmentRoles: AdminRole[] = ["owner", "admin", "fulfilment"];

export const adminResources: AdminResource[] = [
  { table: "products", title: "Products", roles: catalogRoles, columns: ["name", "sku", "status", "price", "currency"], fields: [
    ...namedFields, field("sku", "SKU", "text", true), reference("brand_id", "Brand"), reference("category_id", "Category"),
    field("short_description", "Short description", "textarea", true), field("description", "Description", "textarea", true),
    field("price", "Price (blank for request)", "money"), { key: "currency", label: "Currency", options: ["GBP", "EUR", "USD"], required: true },
    { key: "status", label: "Status", options: ["draft", "active", "archived"], required: true }, field("published_at", "Publish date", "datetime-local"),
    field("materials", "Materials", "textarea"), field("care_information", "Care information", "textarea"), field("tags", "Tags, comma separated", "tags"),
    ...["featured", "is_new_arrival", "is_sale", "inquiry_only"].map((key) => field(key, key.replaceAll("_", " "), "boolean")), field("seo_title", "SEO title"), field("seo_description", "SEO description", "textarea")
  ] },
  { table: "product_variants", title: "Sizes & variants", roles: catalogRoles, columns: ["sku", "name", "size", "color", "product_id"], fields: [reference("product_id", "Product", true), field("sku", "Variant SKU", "text", true), field("name", "Variant name", "text", true), field("size", "Size"), field("color", "Colour"), field("price_override", "Override price", "money"), field("is_active", "Active", "boolean")] },
  { table: "inventory", title: "Inventory", roles: [...catalogRoles, "fulfilment"], key: "variant_id", columns: ["variant_id", "quantity", "reserved_quantity", "allow_backorder"], fields: [reference("variant_id", "Variant", true), field("quantity", "Quantity", "number", true), field("reserved_quantity", "Reserved quantity", "number", true), field("allow_backorder", "Allow backorders", "boolean")] },
  { table: "product_images", title: "Product images", roles: catalogRoles, columns: ["product_id", "alt_text", "position"], fields: [reference("product_id", "Product", true), field("storage_path", "Storage path", "text", true), field("public_url", "Public image URL", "url"), field("alt_text", "Image description", "text", true), field("position", "Gallery position", "number", true)] },
  { table: "brands", title: "Brands", roles: catalogRoles, columns: ["name", "slug", "is_active"], fields: [...namedFields, field("description", "Description", "textarea"), field("is_active", "Active", "boolean")] },
  { table: "categories", title: "Categories", roles: catalogRoles, columns: ["name", "slug", "is_active"], fields: [...namedFields, reference("parent_id", "Parent category"), field("description", "Description", "textarea"), field("is_active", "Active", "boolean")] },
  { table: "collections", title: "Collections", roles: catalogRoles, columns: ["name", "slug", "is_active"], fields: [...namedFields, field("intro", "Introduction", "textarea"), field("hero_image_url", "Hero image URL", "url"), field("hero_image_alt", "Hero image description"), field("published_at", "Publish date", "datetime-local"), field("is_active", "Active", "boolean")] },
  { table: "collection_products", title: "Collection products", roles: catalogRoles, key: "product_id", columns: ["collection_id", "product_id", "position"], fields: [reference("collection_id", "Collection", true), reference("product_id", "Product", true), field("position", "Position", "number", true)] },
  { table: "editorial_content", title: "Lookbook & homepage", roles: catalogRoles, columns: ["page_key", "section_key", "is_published"], fields: [field("page_key", "Page key", "text", true), field("section_key", "Section key", "text", true), field("content", "Section content (JSON object)", "json", true), field("is_published", "Published", "boolean")] },
  { table: "order_requests", title: "Order requests", roles: fulfilmentRoles, noCreate: true, columns: ["public_reference", "customer_name", "customer_email", "status", "created_at"], fields: [{ key: "status", label: "Order status", options: ["order_request", "awaiting_confirmation", "confirmed", "processing", "shipped", "delivered", "cancelled"], required: true }] },
  { table: "profiles", title: "Customers", roles: managementRoles, readOnly: true, columns: ["id", "full_name", "phone", "created_at"], fields: [] },
  { table: "newsletter_subscribers", title: "Newsletter subscribers", roles: managementRoles, readOnly: true, columns: ["email", "status", "consented_at", "unsubscribed_at"], fields: [] },
  { table: "contact_messages", title: "Contact messages", roles: managementRoles, noCreate: true, columns: ["name", "email", "subject", "status"], fields: [{ key: "status", label: "Status", options: ["new", "read", "replied", "archived"] }] },
  { table: "wholesale_inquiries", title: "Wholesale enquiries", roles: managementRoles, noCreate: true, columns: ["company", "name", "email", "status"], fields: [{ key: "status", label: "Status", options: ["new", "reviewing", "quoted", "closed"] }] }
];

export const adminResourcesFor = (role: AdminRole) => adminResources.filter((resource) => resource.roles.includes(role));

export function parseAdminValues(resource: AdminResource, values: Record<string, unknown>) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of resource.fields) {
    let rule: z.ZodType = z.string().trim().max(10000);
    if (f.options) rule = z.enum(f.options as [string, ...string[]]);
    else if (f.type === "number") rule = z.coerce.number().int().min(0).max(2147483647);
    else if (f.type === "money") rule = z.coerce.number().min(0).max(21474836.47).transform((value) => Math.round(value * 100));
    else if (f.type === "boolean") rule = z.boolean();
    else if (f.type === "uuid") rule = z.string().uuid();
    else if (f.type === "url") rule = z.string().url().refine((v) => v.startsWith("https://"), "Use an HTTPS URL.");
    else if (f.type === "datetime-local") rule = z.string().transform((v) => new Date(v).toISOString());
    else if (f.type === "tags") rule = z.string().transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean));
    else if (f.type === "json") rule = z.string().transform((v, ctx) => { try { const parsed: unknown = JSON.parse(v); return z.record(z.string(), z.unknown()).parse(parsed); } catch { ctx.addIssue({ code: "custom", message: "Enter a valid JSON object." }); return z.NEVER; } });
    else if (f.required) rule = z.string().trim().min(1).max(10000);
    if (f.type === "boolean") shape[f.key] = rule;
    else if (!f.required && f.type !== "tags") shape[f.key] = z.preprocess((v) => v === "" ? null : v, rule.nullable());
    else shape[f.key] = rule;
  }
  return z.object(shape).parse(values);
}
