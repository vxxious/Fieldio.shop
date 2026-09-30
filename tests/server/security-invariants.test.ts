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
    const aggregation = readFileSync(fileURLToPath(new URL("../../supabase/migrations/202609250006_master_order_fulfillment_aggregation.sql", import.meta.url)), "utf8");
    expect(aggregation).toMatch(/v_request\.user_id <> \(select auth\.uid\(\)\) or not exists[\s\S]+v_item\.fulfillment_id and fulfillment\.status = 'delivered'/i);
    expect(sql).toMatch(/Sellers cannot review their own products/i);
    expect(sql).toMatch(/unique \(buyer_id, order_item_id\)/i);
    expect(sql).toMatch(/primary key \(review_id, user_id\)/i);
    expect(sql).toMatch(/You cannot vote on your own review/i);
    expect(sql).toMatch(/review owners upload reserved media[\s\S]+product_review_images/i);
    expect(sql).toMatch(/has_admin_role\(array\['owner','admin'\]\)/i);
  });

  it("exposes review actions only for the buyer's delivered items and sends lifecycle email", () => {
    const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/202609250010_delivered_item_review_actions.sql", import.meta.url)), "utf8");
    const sellerApi = readFileSync(fileURLToPath(new URL("../../api/seller.ts", import.meta.url)), "utf8");
    const orderApi = readFileSync(fileURLToPath(new URL("../../api/order-status.ts", import.meta.url)), "utf8");
    expect(sql).toMatch(/requests\.user_id = \(select auth\.uid\(\)\)/i);
    expect(sql).toMatch(/'productSlug', products\.slug[\s\S]+'reviewId', reviews\.id/i);
    expect(sql).toMatch(/reviews\.buyer_id = \(select auth\.uid\(\)\)/i);
    expect(sellerApi).toContain('"buyer-fulfillment-status"');
    expect(sellerApi).toContain("customer_email");
    expect(orderApi).toContain("You can now review each delivered item");
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
    expect(sql).toMatch(/revoke all on function public\.update_vendor_fulfillment_status[\s\S]+from public, anon/i);
    expect(sql).toMatch(/p_status = 'confirmed'[\s\S]+set reserved_quantity = inventory\.reserved_quantity \+ items\.quantity/i);
    expect(sql).toMatch(/p_status = 'shipped'[\s\S]+set quantity = greatest\(0, inventory\.quantity - items\.quantity\)/i);
    const statusValues = readFileSync(fileURLToPath(new URL("../../supabase/migrations/202609250004_vendor_fulfillment_status_values.sql", import.meta.url)), "utf8");
    expect(statusValues).toMatch(/add value if not exists 'accepted'/i);
    expect(statusValues).toMatch(/add value if not exists 'rejected'/i);
    const transitions = readFileSync(fileURLToPath(new URL("../../supabase/migrations/202609250005_vendor_fulfillment_lifecycle.sql", import.meta.url)), "utf8");
    expect(transitions).toMatch(/fulfillment\.status = 'confirmed' and p_status in \('accepted', 'rejected'\)/i);
    expect(transitions).toMatch(/fulfillment\.status = 'accepted' and p_status = 'processing'/i);
    expect(transitions).toMatch(/fulfillment\.status = 'processing' and p_status = 'shipped'/i);
    expect(transitions).toMatch(/p_status = 'rejected'[\s\S]+REJECTION_REASON_REQUIRED/i);
    expect(transitions).toMatch(/payment_status = 'confirmed'[\s\S]+PAYMENT_NOT_CONFIRMED/i);
    expect(transitions).toMatch(/orders\.payment_status[\s\S]+groups\.status in \('accepted', 'processing', 'shipped', 'delivered'\)[\s\S]+orders\.customer_name/i);
    expect(transitions).toMatch(/seller_owner_id is not null and status not in \('accepted', 'processing', 'shipped', 'delivered', 'rejected', 'cancelled'\)[\s\S]+VENDOR_ACCEPTANCE_PENDING/i);
    expect(transitions).toMatch(/when p_status = 'processing' and seller_owner_id is null/i);
    expect(transitions).toMatch(/when p_status = 'delivered' and status = 'shipped'/i);
    expect(transitions).toMatch(/items\.fulfillment_id = fulfillment\.id[\s\S]+reserved_quantity = greatest\(0, inventory\.reserved_quantity - required\.quantity\)/i);
    expect(transitions).toMatch(/revoke all on function public\.update_vendor_fulfillment_status\(uuid, public\.fulfillment_status, text, text, text\) from public, anon/i);
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

  it("derives a buyer-safe master status without erasing completed vendor groups", () => {
    const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/202609250006_master_order_fulfillment_aggregation.sql", import.meta.url)), "utf8");
    expect(sql).toMatch(/create function public\.compute_order_fulfillment_status[\s\S]+when delivered = total then 'delivered'[\s\S]+when delivered > 0 then 'partially_delivered'[\s\S]+when shipped > 0 then 'partially_fulfilled'/i);
    expect(sql).toMatch(/after insert or delete or update of status on public\.order_fulfillments[\s\S]+sync_order_fulfillment_status/i);
    expect(sql).toMatch(/status not in \('rejected', 'cancelled'\)[\s\S]+delivered_count = active_count/i);
    expect(sql).toMatch(/create function public\.buyer_order_fulfillments\(\)[\s\S]+requests\.user_id = \(select auth\.uid\(\)\)/i);
    expect(sql.match(/create function public\.buyer_order_fulfillments\(\)\s+returns table \(([\s\S]*?)\)/i)?.[1]).not.toMatch(/seller_owner_id|tracking_reference/i);
    expect(sql).toMatch(/join public\.order_fulfillments fulfillment on fulfillment\.id = item\.fulfillment_id and fulfillment\.status = 'delivered'/i);
    expect(sql).toMatch(/v_item\.fulfillment_id and fulfillment\.status = 'delivered'/i);
  });

  it("keeps the order timeline immutable and buyer responses private", () => {
    const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/202609250007_order_event_timeline.sql", import.meta.url)), "utf8");
    expect(sql).toMatch(/create table public\.order_events[\s\S]+alter table public\.order_events enable row level security/i);
    expect(sql).toMatch(/revoke all on public\.order_events from public, anon, authenticated[\s\S]+grant select on public\.order_events to authenticated/i);
    expect(sql).toMatch(/ORDER_EVENTS_ARE_IMMUTABLE/i);
    expect(sql).toMatch(/before update or delete on public\.order_events/i);
    expect(sql).toMatch(/new\.actor_id is null[\s\S]+to_jsonb\(new\) - 'actor_id'[\s\S]+return new/i);
    expect(sql).toMatch(/after insert or update of status, confirmed_at, payment_status on public\.order_requests/i);
    expect(sql).toMatch(/after update of status on public\.order_fulfillments/i);
    expect(sql).toMatch(/create function public\.buyer_order_timeline\(\)[\s\S]+request\.user_id = \(select auth\.uid\(\)\)/i);
    const buyerTimeline = sql.match(/create function public\.buyer_order_timeline\(\)\s+returns table \(([\s\S]*?)\)/i)?.[1] ?? "";
    expect(buyerTimeline).not.toMatch(/actor_id|note|rejection_reason/i);
    expect(sql).toMatch(/groups\.carrier[\s\S]+groups\.tracking_reference[\s\S]+groups\.accepted_at[\s\S]+groups\.delivered_at/i);
    expect(sql).toMatch(/where accepted_at is not null[\s\S]+where preparing_at is not null[\s\S]+where shipped_at is not null[\s\S]+where delivered_at is not null/i);
  });

  it("holds only affected seller fulfilments and preserves payout history", () => {
    const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/202609250008_payout_holds_and_adjustments.sql", import.meta.url)), "utf8");
    const supportHandler = readFileSync(fileURLToPath(new URL("../../api/_lib/order-support-handler.ts", import.meta.url)), "utf8");
    const casesHandler = readFileSync(fileURLToPath(new URL("../../api/_lib/cases-handler.ts", import.meta.url)), "utf8");

    expect(sql).toMatch(/create unique index seller_payout_items_active_fulfillment_idx[\s\S]+where status in \('included', 'held', 'paid'\)/i);
    expect(sql).toMatch(/create function public\.apply_payout_case_hold[\s\S]+where id = p_fulfillment_id[\s\S]+for update/i);
    expect(sql).toMatch(/create or replace function public\.create_seller_payout[\s\S]+payout_hold_status = 'clear'[\s\S]+for update of fulfillments/i);
    expect(sql).toMatch(/create or replace function public\.update_seller_payout[\s\S]+item\.status = 'included'[\s\S]+PAYOUT_ON_HOLD/i);
    expect(sql).toMatch(/create table public\.payout_adjustments[\s\S]+recovery_pending[\s\S]+PAYOUT_ADJUSTMENTS_ARE_IMMUTABLE/i);
    expect(sql).toMatch(/payout_resolution[\s\S]+keep_held[\s\S]+PAYOUT_RESOLUTION_IMMUTABLE/i);
    expect(sql).toMatch(/revoke update on public\.marketplace_returns, public\.marketplace_disputes from authenticated/i);
    expect(sql).toMatch(/Existing return:[\s\S]+Existing dispute:[\s\S]+apply_payout_case_hold/i);
    expect(sql).toMatch(/'payout_hold'[\s\S]+'payout_release'[\s\S]+'payout_adjustment'[\s\S]+'refund_recorded'/i);
    expect(sql).toMatch(/create or replace function public\.buyer_order_timeline\(\)[\s\S]+event\.event_type in \([\s\S]+'fulfillment_status_changed'[\s\S]+\)/i);
    expect(supportHandler).toContain('client.rpc("open_marketplace_return"');
    expect(supportHandler).toContain('client.rpc("open_marketplace_dispute"');
    expect(supportHandler).not.toMatch(/from\("marketplace_(?:returns|disputes)"\)\.insert/);
    expect(casesHandler).toContain('client.rpc("update_marketplace_case"');
    expect(casesHandler).not.toMatch(/from\(table\)\.update/);
  });

  it("requires an authenticated buyer before creating an order", () => {
    const source = readFileSync(fileURLToPath(new URL("../../api/order-requests.ts", import.meta.url)), "utf8");
    expect(source).toContain("getAuthenticatedSupabase(request)");
    expect(source).toContain("p_user_id: user.id");
    expect(source).not.toMatch(/let userId: string \| null|p_user_id: null/);
  });

  it("keeps campaigns, admin invitations, payouts, returns, and disputes server-enforced", () => {
    const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/202609240006_admin_campaigns_and_operations.sql", import.meta.url)), "utf8");
    expect(sql).toMatch(/token_hash text not null unique/i);
    expect(sql).not.toMatch(/admin_invitations[\s\S]{0,500}\btoken\s+text/i);
    expect(sql).toMatch(/lower\(invitation\.email\) <> user_email/i);
    expect(sql).toMatch(/expires_at <= now\(\)/i);
    expect(sql).toMatch(/alter table public\.email_campaigns enable row level security/i);
    expect(sql).toMatch(/marketing staff read campaigns[\s\S]+has_admin_role\(array\['owner','admin'\]\)/i);
    expect(sql).toMatch(/create_seller_payout[\s\S]+for update of fulfillments/i);
    expect(sql).toMatch(/buyers and operations read returns[\s\S]+buyer_id = \(select auth\.uid\(\)\)/i);
    expect(sql).toMatch(/buyers and operations read disputes[\s\S]+opened_by = \(select auth\.uid\(\)\)/i);
    const campaigns = readFileSync(fileURLToPath(new URL("../../api/_lib/campaigns-handler.ts", import.meta.url)), "utf8");
    const staff = readFileSync(fileURLToPath(new URL("../../api/_lib/admin.ts", import.meta.url)), "utf8");
    expect(staff).toContain('rpc("has_admin_role", { p_roles: roles })');
    expect(campaigns).toContain('emailRequest<{ data?: Array<{ id?: string }> }>("/emails/batch"');
    expect(campaigns).toContain('"Idempotency-Key": `campaign/${campaign.id}/${chunk[0]!.id}/${attempt}`');
  });

  it("requires a confirmed customer payment before fulfilment and seller payout", () => {
    const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/202609250003_order_payment_confirmation.sql", import.meta.url)), "utf8");
    expect(sql).toMatch(/create or replace function public\.confirm_order_payment[\s\S]+security definer[\s\S]+has_admin_role\(array\['owner','admin'\]\)/i);
    expect(sql).toMatch(/new\.status in \('processing', 'shipped', 'delivered'\)[\s\S]+PAYMENT_NOT_CONFIRMED/i);
    expect(sql).toMatch(/status = 'delivered'[\s\S]+orders\.payment_status = 'confirmed'[\s\S]+then 'eligible'/i);
    expect(sql).toMatch(/require_payment_before_payout_status[\s\S]+before update of status on public\.seller_payouts/i);
    expect(sql).toMatch(/revoke insert, update, delete on public\.seller_payouts, public\.seller_payout_items from authenticated/i);
  });

  it("keeps seller stock variant-specific and reserves it atomically at checkout", () => {
    const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/202609250009_variant_inventory_matrix.sql", import.meta.url)), "utf8");
    expect(sql).toMatch(/create table public\.seller_listing_variants[\s\S]+unique index seller_listing_variants_option_unique/i);
    expect(sql).toMatch(/alter table public\.seller_listing_variants enable row level security[\s\S]+owners and management read seller listing variants/i);
    expect(sql).toMatch(/create function public\.save_seller_listing_inventory[\s\S]+listing\.status not in \('draft', 'rejected'\)/i);
    expect(sql).toMatch(/for matrix in[\s\S]+insert into public\.product_variants[\s\S]+matrix\.color \|\| ' \/ ' \|\| matrix\.size[\s\S]+insert into public\.inventory\(variant_id, quantity/i);
    expect(sql).toMatch(/perform inventory\.variant_id[\s\S]+order by inventory\.variant_id[\s\S]+for update of inventory[\s\S]+set reserved_quantity = inventory\.reserved_quantity \+ required\.quantity/i);
    expect(sql).toMatch(/p_status = 'cancelled'[\s\S]+reserved_quantity = greatest\(0, inventory\.reserved_quantity - required\.quantity\)/i);
    expect(sql).toMatch(/create function public\.update_seller_listing_inventory[\s\S]+QUANTITY_BELOW_RESERVED_STOCK/i);
    expect(sql).toMatch(/revoke all on function public\.create_order_request\(jsonb,jsonb,uuid,uuid\) from public, anon, authenticated/i);
  });

  it("keeps vendor storefront product linkage exclusive to seller approval", () => {
    const boundary = readFileSync(fileURLToPath(new URL("../../supabase/migrations/202609250002_vendor_storefront_product_boundary.sql", import.meta.url)), "utf8");
    const sellerFlow = readFileSync(fileURLToPath(new URL("../../supabase/migrations/202609170001_seller_marketplace.sql", import.meta.url)), "utf8");
    const adminResources = readFileSync(fileURLToPath(new URL("../../src/lib/admin-resources.ts", import.meta.url)), "utf8");
    const columnGrants = [...boundary.matchAll(/grant (?:insert|update) \(([\s\S]*?)\) on public\.products to authenticated/gi)];

    expect(boundary).toMatch(/revoke insert, update on public\.products from anon, authenticated/i);
    expect(columnGrants).toHaveLength(2);
    for (const grant of columnGrants) expect(grant[1]).not.toMatch(/seller_listing_id|seller_verified|seller_store_/i);
    expect(adminResources).not.toMatch(/seller_listing_id|seller_verified|seller_store_/i);
    expect(sellerFlow).toMatch(/security definer[\s\S]+insert into public\.products[\s\S]+seller_listing_id/i);
  });
});
