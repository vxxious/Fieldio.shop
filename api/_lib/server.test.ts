import { describe, expect, it, vi } from "vitest";
import { handleApiError, readValidatedJson } from "./server.js";
import { captureServerException } from "./monitoring.js";
import { z } from "zod";

vi.mock("./monitoring.js", () => ({ captureServerException: vi.fn() }));

const schema = z.object({ value: z.string() });

describe("API request boundary", () => {
  it("rejects cross-site JSON mutations", async () => {
    const request = new Request("https://fieldio.shop/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json", "sec-fetch-site": "cross-site" },
      body: JSON.stringify({ value: "test" })
    });

    await expect(readValidatedJson(request, schema)).rejects.toThrow("CROSS_SITE_REQUEST");
    expect(handleApiError(new Error("CROSS_SITE_REQUEST")).status).toBe(403);
  });

  it("accepts same-origin JSON", async () => {
    const request = new Request("https://fieldio.shop/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json", "sec-fetch-site": "same-origin" },
      body: JSON.stringify({ value: "test" })
    });

    await expect(readValidatedJson(request, schema)).resolves.toEqual({ value: "test" });
  });

  it("removes unsafe control characters before validation and storage", async () => {
    const request = new Request("https://fieldio.shop/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "clean\u0000text\u0007" })
    });

    await expect(readValidatedJson(request, schema)).resolves.toEqual({ value: "cleantext" });
  });

  it("rejects oversized JSON before validation", async () => {
    const request = new Request("https://fieldio.shop/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(32768) })
    });

    await expect(readValidatedJson(request, schema)).rejects.toThrow("BODY_TOO_LARGE");
  });

  it("reports unexpected server failures without reporting expected request errors", () => {
    const error = new Error("DATABASE_FAILURE");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(handleApiError(error).status).toBe(500);
    expect(captureServerException).toHaveBeenCalledWith(error);
    vi.mocked(captureServerException).mockClear();
    expect(handleApiError(new Error("AUTH_REQUIRED")).status).toBe(401);
    expect(captureServerException).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
