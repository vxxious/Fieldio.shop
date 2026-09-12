import { describe, expect, it } from "vitest";
import { convertCurrencyAmount, detectBrowserPreference, formatLocalizedPrice } from "./localization";

describe("localization", () => {
  it("uses the browser region and a supported language", () => {
    expect(detectBrowserPreference("fr-CA")).toEqual({ region: "CA", language: "fr" });
    expect(detectBrowserPreference("de-DE")).toEqual({ region: "DE", language: "de" });
  });

  it("falls back to Fieldio's United Kingdom region safely", () => {
    expect(detectBrowserPreference("not-a-locale").region).toBe("GB");
  });

  it("converts through the trusted base rate without changing stored prices", () => {
    expect(convertCurrencyAmount(100, "EUR", "USD", { EUR: 1.25, USD: 1.5 })).toBeCloseTo(120);
  });

  it("shows source currency when a requested rate is unavailable", () => {
    const value = formatLocalizedPrice(12900, "GBP", "NGN", "en-NG", { GBP: 1 });
    expect(value).toContain("129");
    expect(value).toMatch(/£|GBP/);
  });
});
