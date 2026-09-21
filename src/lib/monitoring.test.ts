import { describe, expect, it } from "vitest";
import { stripSensitiveUrl } from "./monitoring";

describe("Sentry privacy boundary", () => {
  it("removes query strings and fragments from captured URLs", () => {
    expect(stripSensitiveUrl("https://fieldio.shop/account?code=secret#token")).toBe("https://fieldio.shop/account");
  });
});
