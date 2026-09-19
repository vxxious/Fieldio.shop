import { describe, expect, it } from "vitest";
import { internationalPhone, isPhoneCountryCode, nationalPhone, phoneCountryOptions } from "./phone";

describe("seller phone details", () => {
  it("pairs country names and calling codes with normalized numbers", () => {
    expect(phoneCountryOptions().find(({ code }) => code === "NG")).toMatchObject({ name: "Nigeria", dialCode: "+234" });
    expect(internationalPhone("NG", "0801 234 5678")).toBe("+2348012345678");
    expect(nationalPhone("NG", "+2348012345678")).toBe("8012345678");
    expect(isPhoneCountryCode("toString")).toBe(false);
  });
});
