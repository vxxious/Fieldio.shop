// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { preferenceToken, readPreferenceToken } from "../../api/_lib/newsletter";
import { renderPreferencePage } from "../../api/newsletter-preferences";
afterEach(() => vi.unstubAllEnvs());
it("rejects altered preference links", () => {
  vi.stubEnv("NEWSLETTER_TOKEN_SECRET", "test-secret-used-only-in-tests");
  const token = preferenceToken("aabbccdd-0000-4000-8000-000000000000", "unsubscribe");
  expect(readPreferenceToken(token).action).toBe("unsubscribe");
  expect(() => readPreferenceToken(token.slice(0, -5) + "xxxxx")).toThrow();
});

it("renders a branded responsive preference screen", () => {
  const html = renderPreferencePage({ title: "Join the Fieldio list.", message: "Confirm your email.", action: "Confirm subscription" });
  expect(html).toContain("/brand/fieldio-email-logo.png");
  expect(html).toContain("prefers-color-scheme:dark");
  expect(html).toContain("Confirm subscription");
  expect(html).toContain("Schibsted Grotesk");
  expect(html).toContain("button,.primary-link{color:#11120f}");
  expect(html).not.toContain("background:#1688f8");
});
