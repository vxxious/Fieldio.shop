// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const readDirectory = (relativePath: string) => {
  const directory = fileURLToPath(new URL(relativePath, import.meta.url));
  return readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => ({ name: entry.name, source: readFileSync(`${directory}/${entry.name}`, "utf8") }));
};

const readTree = (relativePath: string) => {
  const directory = fileURLToPath(new URL(relativePath, import.meta.url));
  const files: string[] = [];
  const visit = (path: string) => readdirSync(path, { withFileTypes: true }).forEach((entry) => entry.isDirectory() ? visit(`${path}/${entry.name}`) : files.push(`${path}/${entry.name}`));
  visit(directory);
  return files.map((path) => readFileSync(path, "utf8")).join("\n");
};

describe("security invariants", () => {
  it("sets clickjacking protection and exact production CORS origin", () => {
    const config = readFileSync(fileURLToPath(new URL("../../vercel.json", import.meta.url)), "utf8");
    expect(config).toMatch(/"X-Frame-Options", "value": "DENY"/);
    expect(config).toMatch(/"Access-Control-Allow-Origin", "value": "https:\/\/fieldio\.shop"/);
    expect(config).not.toMatch(/"Access-Control-Allow-Origin", "value": "\*"/);
  });

  it("stays within the Vercel Hobby serverless function limit", () => {
    expect(readDirectory("../../api/").filter(({ name }) => name.endsWith(".ts"))).toHaveLength(12);
  });

  it("rate limits every API route", () => {
    const missing = readDirectory("../../api/").filter(({ name }) => name.endsWith(".ts")).filter(({ source }) => !source.includes("checkRateLimit")).map(({ name }) => name);
    expect(missing).toEqual([]);
  });

  it("enables RLS and defines access policy for every public table", () => {
    const sql = readDirectory("../../supabase/migrations/").filter(({ name }) => name.endsWith(".sql")).map(({ source }) => source).join("\n");
    const tables = [...sql.matchAll(/create table(?: if not exists)? public\.([a-z_]+)/gi)].map((match) => match[1]!);
    const secured = new Set([...sql.matchAll(/alter table public\.([a-z_]+) enable row level security/gi)].map((match) => match[1]!));
    const policies = new Set([...sql.matchAll(/create policy [^\n]+ on public\.([a-z_]+)/gi)].map((match) => match[1]!));
    const serverOnlyTables = new Set(["api_rate_limits", "notification_deliveries"]);

    expect(tables.filter((table) => !secured.has(table))).toEqual([]);
    expect(tables.filter((table) => !serverOnlyTables.has(table) && !policies.has(table))).toEqual([]);
  });

  it("keeps privileged environment variable names out of frontend source", () => {
    const source = readTree("../../src/");
    expect(source).not.toMatch(/SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|NEWSLETTER_TOKEN_SECRET/);
  });

  it("limits seller contact changes to the approved owner and records an audit event", () => {
    const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/202609190002_seller_contact_numbers.sql", import.meta.url)), "utf8");
    expect(sql).toMatch(/security definer\s+set search_path = ''/i);
    expect(sql).toMatch(/owner_id = \(select auth\.uid\(\)\) and status = 'approved'/i);
    expect(sql).toMatch(/owner_id = \(select auth\.uid\(\)\) and status = 'active'/i);
    expect(sql).toContain("'seller.contacts_updated'");
    expect(sql).toMatch(/revoke all on function public\.update_seller_contacts[\s\S]+from public/i);
  });

  it("requires AAL2 for staff authorization and stock-controls seller products", () => {
    const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/202609200002_marketplace_hardening.sql", import.meta.url)), "utf8");
    expect(sql).toMatch(/auth\.jwt\(\)->>'aal'\) = 'aal2'/i);
    expect(sql).toMatch(/new\.inquiry_only := false/i);
    expect(sql).toMatch(/set quantity = listing\.quantity[\s\S]+allow_backorder = false/i);
  });

  it("keeps profile media owner-written and store logos tied to the seller", () => {
    const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/202609220001_profile_media_and_store_logo.sql", import.meta.url)), "utf8");
    const upsertSql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/202609220002_profile_media_upsert_policy.sql", import.meta.url)), "utf8");
    expect(sql).toMatch(/logo_path = owner_id::text \|\| '\/store-logo'/i);
    expect(sql).toMatch(/bucket_id = 'profile-media'[\s\S]+name in \(\(select auth\.uid\(\)\)::text \|\| '\/avatar', \(select auth\.uid\(\)\)::text \|\| '\/store-logo'\)/i);
    expect(upsertSql).toMatch(/for select to authenticated[\s\S]+bucket_id = 'profile-media'[\s\S]+name in \(\(select auth\.uid\(\)\)::text \|\| '\/avatar', \(select auth\.uid\(\)\)::text \|\| '\/store-logo'\)/i);
    expect(sql).toMatch(/new\.seller_store_logo_path/i);
    expect(sql).toMatch(/after update of name, slug, logo_path/i);
  });

  it("enforces verified-purchase reviews, unique votes, and reserved review media", () => {
    const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/202609230001_product_reviews.sql", import.meta.url)), "utf8");
    expect(sql).toMatch(/v_request\.user_id <> \(select auth\.uid\(\)\) or v_request\.status <> 'delivered'/i);
    expect(sql).toMatch(/Sellers cannot review their own products/i);
    expect(sql).toMatch(/unique \(buyer_id, order_item_id\)/i);
    expect(sql).toMatch(/primary key \(review_id, user_id\)/i);
    expect(sql).toMatch(/You cannot vote on your own review/i);
    expect(sql).toMatch(/review owners upload reserved media[\s\S]+product_review_images/i);
    expect(sql).toMatch(/has_admin_role\(array\['owner','admin'\]\)/i);
  });

  it("keeps review media private until the owned upload set is finalized", () => {
    const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/202609230002_review_media_hardening.sql", import.meta.url)), "utf8");
    expect(sql).toMatch(/update storage\.buckets set public = false where id = 'review-media'/i);
    expect(sql).toMatch(/status text not null default 'ready'[\s\S]+status in \('pending', 'ready'\)/i);
    expect(sql).toMatch(/create or replace function public\.finalize_review_images/i);
    expect(sql).toMatch(/storage\.objects object[\s\S]+object\.bucket_id = 'review-media'/i);
    expect(sql).toMatch(/image\.status = 'ready'[\s\S]+review\.status = 'published'/i);
    expect(sql).toMatch(/review owners delete own media[\s\S]+storage\.foldername\(name\)/i);
  });

  it("splits marketplace orders into server-owned vendor fulfillment groups", () => {
    const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/202609240001_vendor_fulfillments.sql", import.meta.url)), "utf8");
    expect(sql).toMatch(/constraint order_fulfillments_order_group_unique unique \(order_request_id, group_key\)/i);
    expect(sql).toMatch(/insert into public\.order_fulfillments[\s\S]+insert into public\.order_items\(fulfillment_id/i);
    expect(sql).toMatch(/seller_owner_id = \(select auth\.uid\(\)\)[\s\S]+status = 'approved'/i);
    expect(sql).toMatch(/create or replace function public\.seller_order_fulfillments\(\)[\s\S]+security definer[\s\S]+set search_path = ''/i);
    expect(sql).toMatch(/create or replace function public\.update_vendor_fulfillment_status[\s\S]+seller_owner_id = \(select auth\.uid\(\)/i);
    expect(sql).toMatch(/fulfillment\.status = 'confirmed' and p_status in \('processing', 'shipped'\)/i);
    expect(sql).toMatch(/revoke all on function public\.update_vendor_fulfillment_status[\s\S]+from public, anon/i);
    expect(sql).toMatch(/p_status = 'confirmed'[\s\S]+set reserved_quantity = inventory\.reserved_quantity \+ items\.quantity/i);
    expect(sql).toMatch(/p_status = 'shipped'[\s\S]+set quantity = greatest\(0, inventory\.quantity - items\.quantity\)/i);
    const transitions = readFileSync(fileURLToPath(new URL("../../supabase/migrations/202609240003_fulfillment_transition_integrity.sql", import.meta.url)), "utf8");
    expect(transitions).toMatch(/seller_owner_id is not null and status not in \('shipped', 'delivered'\)[\s\S]+VENDOR_FULFILLMENT_PENDING/i);
    expect(transitions).toMatch(/p_status = 'processing' and status in \('pending', 'confirmed'\)/i);
    expect(transitions).toMatch(/p_status = 'cancelled'[\s\S]+status in \('shipped', 'delivered'\)/i);
    const response = readFileSync(fileURLToPath(new URL("../../supabase/migrations/202609240004_buyer_safe_order_response.sql", import.meta.url)), "utf8");
    expect(response).toMatch(/return jsonb_build_object\('reference', v_order\.public_reference, 'items', v_result\)/i);
    expect(response).not.toMatch(/sellerOwnerId|fulfillments'/i);
    const shipping = readFileSync(fileURLToPath(new URL("../../supabase/migrations/202609240005_vendor_shipping_details.sql", import.meta.url)), "utf8");
    expect(shipping).toMatch(/p_status = 'shipped'[\s\S]+SHIPPING_DETAILS_REQUIRED/i);
    expect(shipping).toMatch(/carrier = case when p_status = 'shipped' then btrim\(p_carrier\)/i);
    expect(shipping).toMatch(/tracking_reference = case when p_status = 'shipped' then btrim\(p_tracking_reference\)/i);
    expect(shipping).toMatch(/seller_owner_id = \(select auth\.uid\(\)\)[\s\S]+seller_store_id is not null/i);
    expect(shipping).toMatch(/revoke all on function public\.update_vendor_fulfillment_status\(uuid, public\.fulfillment_status, text, text\) from public, anon/i);
  });

  it("requires an authenticated buyer before creating an order", () => {
    const source = readFileSync(fileURLToPath(new URL("../../api/order-requests.ts", import.meta.url)), "utf8");
    expect(source).toContain("getAuthenticatedSupabase(request)");
    expect(source).toContain("p_user_id: user.id");
    expect(source).not.toMatch(/let userId: string \| null|p_user_id: null/);
  });
});
