// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getLocale } from "../../api/locale";
import { GET as getRates } from "../../api/rates";

afterEach(() => vi.unstubAllGlobals());

describe("localization APIs", () => {
  it("reads only country and language from deployment headers", async () => {
    const response = getLocale(new Request("https://fieldio.shop/api/locale", { headers: { "x-vercel-ip-country": "fr", "accept-language": "fr-FR,fr;q=0.9" } }));
    await expect(response.json()).resolves.toEqual({ country: "FR", language: "fr-FR" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("normalizes and caches current reference rates", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([{ quote: "eur", rate: 1.16 }, { quote: "USD", rate: 1.34 }]), { status: 200 })));
    const response = await getRates(new Request("https://fieldio.shop/api/rates?base=GBP"));
    await expect(response.json()).resolves.toEqual({ base: "GBP", rates: { EUR: 1.16, USD: 1.34 } });
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=21600");
  });

  it("rejects invalid currency input without calling the provider", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await getRates(new Request("https://fieldio.shop/api/rates?base=not-money"));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
