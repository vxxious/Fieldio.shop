import { describe, expect, it } from "vitest";
import { isMissingCatalogTrustColumn } from "./useCatalog";

describe("catalog schema compatibility", () => {
  it("retries only when a new trust column is missing", () => {
    expect(isMissingCatalogTrustColumn({ code: "PGRST204", message: "Could not find the seller_verified column" })).toBe(true);
    expect(isMissingCatalogTrustColumn({ code: "42501", message: "permission denied" })).toBe(false);
  });
});
