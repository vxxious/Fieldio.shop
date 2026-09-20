// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getAdminSupabase: vi.fn(),
  preferenceToken: vi.fn(),
  readPreferenceToken: vi.fn(),
  sendTransactionalEmail: vi.fn()
}));

vi.mock("../../api/_lib/server.js", () => ({ checkRateLimit: mocks.checkRateLimit, getAdminSupabase: mocks.getAdminSupabase }));
vi.mock("../../api/_lib/newsletter.js", () => ({ preferenceToken: mocks.preferenceToken, readPreferenceToken: mocks.readPreferenceToken }));
vi.mock("../../api/_lib/email.js", () => ({
  escapeHtml: (value: string) => value,
  sendTransactionalEmail: mocks.sendTransactionalEmail
}));

import { POST } from "../../api/newsletter-preferences";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

it("confirms a subscriber without depending on a Resend contact list", async () => {
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const database = {
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { email: "reader@example.com", status: "unsubscribed" }, error: null }) }) }),
      update: () => ({ eq: updateEq })
    }))
  };
  vi.stubEnv("APP_URL", "https://fieldio.shop");
  mocks.checkRateLimit.mockResolvedValue(true);
  mocks.getAdminSupabase.mockReturnValue(database);
  mocks.readPreferenceToken.mockReturnValue({ id: "aabbccdd-0000-4000-8000-000000000000", action: "subscribe", expires: Date.now() + 60_000 });
  mocks.preferenceToken.mockReturnValue("unsubscribe-token");
  mocks.sendTransactionalEmail.mockResolvedValue(true);

  const response = await POST(new Request("https://fieldio.shop/api/newsletter-preferences?token=valid", { method: "POST" }));

  expect(response.status).toBe(200);
  expect(await response.text()).toContain("You are on the list.");
  expect(updateEq).toHaveBeenCalledWith("id", "aabbccdd-0000-4000-8000-000000000000");
  expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(expect.objectContaining({ subject: "Welcome to the Fieldio list" }));
});
