// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { preferenceToken, readPreferenceToken } from "../../api/_lib/newsletter";
afterEach(() => vi.unstubAllEnvs());
it("rejects altered preference links", () => {
  vi.stubEnv("NEWSLETTER_TOKEN_SECRET", "test-secret-used-only-in-tests");
  const token = preferenceToken("aabbccdd-0000-4000-8000-000000000000", "unsubscribe");
  expect(readPreferenceToken(token).action).toBe("unsubscribe");
  expect(() => readPreferenceToken(token.slice(0, -5) + "xxxxx")).toThrow();
});
