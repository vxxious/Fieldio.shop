import { describe, expect, it } from "vitest";
import { renderCampaignEmail } from "./campaign.js";

describe("campaign email renderer", () => {
  it("escapes campaign content and keeps the approved responsive dark-mode shell", () => {
    const email = renderCampaignEmail({
      subject: "New <drop>",
      heading: "Autumn & winter",
      body: "First <script>alert(1)</script> paragraph.\n\nSecond line.",
      actionLabel: "Shop now",
      actionUrl: "https://fieldio.shop/shop?from=email&drop=autumn"
    }, "https://fieldio.shop/api/newsletter-preferences?token=safe");

    expect(email.html).toContain('name="color-scheme" content="light dark"');
    expect(email.html).toContain("@media(prefers-color-scheme:dark)");
    expect(email.html).toContain("fieldio-email-logo.png");
    expect(email.html).toContain("New &lt;drop&gt;");
    expect(email.html).toContain("Autumn &amp; winter");
    expect(email.html).toContain("First &lt;script&gt;alert(1)&lt;/script&gt; paragraph.");
    expect(email.html).toContain("from=email&amp;drop=autumn");
    expect(email.html).toContain("Unsubscribe");
    expect(email.html).not.toContain("<script>alert(1)</script>");
    expect(email.text).toContain("Unsubscribe: https://fieldio.shop/api/newsletter-preferences?token=safe");
  });
});
