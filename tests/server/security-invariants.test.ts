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
    expect(sql).toMatch(/logo_path = owner_id::text \|\| '\/store-logo'/i);
    expect(sql).toMatch(/bucket_id = 'profile-media'[\s\S]+name in \(\(select auth\.uid\(\)\)::text \|\| '\/avatar', \(select auth\.uid\(\)\)::text \|\| '\/store-logo'\)/i);
    expect(sql).toMatch(/new\.seller_store_logo_path/i);
    expect(sql).toMatch(/after update of name, slug, logo_path/i);
  });
});
