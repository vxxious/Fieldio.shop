import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderTransactionalEmail, sendTrackedEmail } from "./email.js";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM;
});

describe("transactional email renderer", () => {
  it("uses the approved Fieldio shell and escapes untrusted content", () => {
    const result = renderTransactionalEmail({
      heading: "Order <confirmed>",
      message: "Hello & welcome",
      details: [{ label: "Reference", value: "FLD-1 <script>" }],
      action: { label: "View order", url: "https://fieldio.shop/account?a=1&b=2" }
    });

    expect(result.html).toContain("fieldio-email-logo.png");
    expect(result.html).toContain("mix-blend-mode:difference");
    expect(result.html).toContain('name="color-scheme" content="light dark"');
    expect(result.html).toContain("@media (prefers-color-scheme:dark)");
    expect(result.html).toContain(".email-action{background-color:#f7f7f4!important");
    expect(result.html).toContain("Order &lt;confirmed&gt;");
    expect(result.html).toContain("Hello &amp; welcome");
    expect(result.html).toContain("FLD-1 &lt;script&gt;");
    expect(result.html).toContain("a=1&amp;b=2");
    expect(result.html).not.toContain("<script>");
    expect(result.text).toContain("View order: https://fieldio.shop/account?a=1&b=2");
  });

  it("records and sends a delivery once", async () => {
    process.env.RESEND_API_KEY = "test-key";
    process.env.RESEND_FROM = "Fieldio <test@fieldio.shop>";
    const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
    const database = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "delivery-1" }, error: null })) })) })),
        update
      }))
    } as unknown as SupabaseClient;
    const request = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", request);

    await expect(sendTrackedEmail(database, "order:1:confirmed", "order-status", { to: "Customer@Example.com", subject: "Confirmed", heading: "Confirmed", message: "Ready" })).resolves.toBe("sent");
    expect(request).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "sent" }));
  });

  it("does not resend an existing delivery", async () => {
    const retry = { eq: vi.fn(), select: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) };
    retry.eq.mockReturnValue(retry);
    const database = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: null, error: { code: "23505" } })) })) })),
        update: vi.fn(() => retry)
      }))
    } as unknown as SupabaseClient;
    const request = vi.fn();
    vi.stubGlobal("fetch", request);

    await expect(sendTrackedEmail(database, "order:1:confirmed", "order-status", { to: "customer@example.com", subject: "Confirmed", heading: "Confirmed", message: "Ready" })).resolves.toBe("duplicate");
    expect(request).not.toHaveBeenCalled();
  });
});
