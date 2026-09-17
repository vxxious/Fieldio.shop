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

    expect(tables.filter((table) => !secured.has(table))).toEqual([]);
    expect(tables.filter((table) => table !== "api_rate_limits" && !policies.has(table))).toEqual([]);
  });

  it("keeps privileged environment variable names out of frontend source", () => {
    const source = readTree("../../src/");
    expect(source).not.toMatch(/SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|NEWSLETTER_TOKEN_SECRET/);
  });
});
