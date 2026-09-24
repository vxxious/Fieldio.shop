// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { verifyResendWebhook } from "./resend-webhook-handler.js";

afterEach(() => { delete process.env.RESEND_WEBHOOK_SECRET; });

describe("Resend webhook verification", () => {
  it("accepts only a current, correctly signed payload", () => {
    const key = Buffer.from("fieldio-webhook-test-key");
    process.env.RESEND_WEBHOOK_SECRET = `whsec_${key.toString("base64")}`;
    const body = JSON.stringify({ type: "email.delivered", data: { email_id: "email-1" } });
    const timestamp = "1800000000";
    const id = "msg_test";
    const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
    const headers = new Headers({ "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` });

    expect(verifyResendWebhook(body, headers, 1_800_000_000_000)).toBe(true);
    expect(verifyResendWebhook(`${body} `, headers, 1_800_000_000_000)).toBe(false);
    expect(verifyResendWebhook(body, headers, 1_800_000_400_000)).toBe(false);
  });
});
