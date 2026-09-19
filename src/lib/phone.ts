import { regionOptions } from "./regions";

const callingCodes: Record<string, string> = {
  AD: "+376", AE: "+971", AF: "+93", AG: "+1", AI: "+1", AL: "+355", AM: "+374", AO: "+244", AR: "+54", AT: "+43", AU: "+61",
  BE: "+32", BR: "+55", CA: "+1", CH: "+41", CN: "+86", DE: "+49", DK: "+45", DZ: "+213", EG: "+20", ES: "+34", FI: "+358",
  FR: "+33", GB: "+44", GH: "+233", GR: "+30", HK: "+852", IE: "+353", IN: "+91", IT: "+39", JP: "+81", KE: "+254", KR: "+82",
  LU: "+352", MA: "+212", MX: "+52", NG: "+234", NL: "+31", NO: "+47", NZ: "+64", PL: "+48", PT: "+351", QA: "+974", SA: "+966",
  SE: "+46", SG: "+65", TR: "+90", US: "+1", ZA: "+27"
};

export const phoneCountryCodes = regionOptions.flatMap(({ code }) => callingCodes[code] ? [code] : []);

export function phoneCountryOptions(locale = "en-GB") {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  return phoneCountryCodes.map((code) => ({ code, dialCode: callingCodes[code]!, name: names.of(code) ?? code })).sort((a, b) => a.name.localeCompare(b.name, locale));
}

export function internationalPhone(countryCode: string, nationalNumber: string): string {
  const dialCode = callingCodes[countryCode];
  const number = nationalNumber.replace(/\D/g, "").replace(/^0+/, "");
  return dialCode && number ? `${dialCode}${number}` : "";
}

export function nationalPhone(countryCode: string, internationalNumber: string | null | undefined): string {
  const dialCode = callingCodes[countryCode];
  const number = internationalNumber?.replace(/\D/g, "") ?? "";
  return dialCode && number.startsWith(dialCode.slice(1)) ? number.slice(dialCode.length - 1) : number;
}

export function isPhoneCountryCode(value: string): boolean {
  return Object.hasOwn(callingCodes, value);
}
