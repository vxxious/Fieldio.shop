import { describe, expect, it } from "vitest";
import { getCampaignAttribution } from "./analytics";

describe("campaign attribution", () => {
  it("keeps only bounded standard UTM values", () => {
    expect(getCampaignAttribution("?utm_source=instagram&utm_campaign=launch&email=private&utm_term=%20%20")).toEqual({
      utm_source: "instagram",
      utm_campaign: "launch"
    });
  });
});
