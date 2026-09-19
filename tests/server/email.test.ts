// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { sendTransactionalEmail } from "../../api/_lib/email";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("escapes submitted content before sending a transactional email", async () => {
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubEnv("RESEND_FROM", "Fieldio <no-reply@mail.fieldio.shop>");
  const request = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", request);

  await expect(sendTransactionalEmail({ to: "buyer@example.com", subject: "Received", heading: "Hello", message: "<script>alert(1)</script>", details: [{ label: "Name", value: "A & B" }] })).resolves.toBe(true);
  const body = JSON.parse(request.mock.calls[0]![1].body as string) as { html: string };
  expect(body.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  expect(body.html).toContain("A &amp; B");
  expect(body.html).not.toContain("<script>");

  vi.spyOn(console, "error").mockImplementation(() => undefined);
  request.mockRejectedValueOnce(new Error("provider unavailable"));
  await expect(sendTransactionalEmail({ to: "buyer@example.com", subject: "Received", heading: "Hello", message: "Saved first" })).resolves.toBe(false);
});
