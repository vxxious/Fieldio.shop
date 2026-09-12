export type LanguageCode = "en" | "fr" | "de" | "es" | "it" | "pt" | "ar";

export interface RegionOption {
  code: string;
  currency: string;
  defaultLanguage: LanguageCode;
}

export const languageOptions: ReadonlyArray<{ code: LanguageCode; name: string; locale: string; direction: "ltr" | "rtl" }> = [
  { code: "en", name: "English", locale: "en-GB", direction: "ltr" },
  { code: "fr", name: "Français", locale: "fr-FR", direction: "ltr" },
  { code: "de", name: "Deutsch", locale: "de-DE", direction: "ltr" },
  { code: "es", name: "Español", locale: "es-ES", direction: "ltr" },
  { code: "it", name: "Italiano", locale: "it-IT", direction: "ltr" },
  { code: "pt", name: "Português", locale: "pt-PT", direction: "ltr" },
  { code: "ar", name: "العربية", locale: "ar-AE", direction: "rtl" }
];

export const regionOptions: ReadonlyArray<RegionOption> = [
  { code: "AU", currency: "AUD", defaultLanguage: "en" },
  { code: "CA", currency: "CAD", defaultLanguage: "en" },
  { code: "GB", currency: "GBP", defaultLanguage: "en" },
  { code: "US", currency: "USD", defaultLanguage: "en" },
  { code: "AF", currency: "AFN", defaultLanguage: "en" },
  { code: "AL", currency: "ALL", defaultLanguage: "en" },
  { code: "DZ", currency: "DZD", defaultLanguage: "fr" },
  { code: "AD", currency: "EUR", defaultLanguage: "es" },
  { code: "AO", currency: "AOA", defaultLanguage: "pt" },
  { code: "AI", currency: "XCD", defaultLanguage: "en" },
  { code: "AG", currency: "XCD", defaultLanguage: "en" },
  { code: "AR", currency: "ARS", defaultLanguage: "es" },
  { code: "AM", currency: "AMD", defaultLanguage: "en" },
  { code: "AT", currency: "EUR", defaultLanguage: "de" },
  { code: "BE", currency: "EUR", defaultLanguage: "fr" },
  { code: "BR", currency: "BRL", defaultLanguage: "pt" },
  { code: "CN", currency: "CNY", defaultLanguage: "en" },
  { code: "DK", currency: "DKK", defaultLanguage: "en" },
  { code: "EG", currency: "EGP", defaultLanguage: "ar" },
  { code: "FI", currency: "EUR", defaultLanguage: "en" },
  { code: "FR", currency: "EUR", defaultLanguage: "fr" },
  { code: "DE", currency: "EUR", defaultLanguage: "de" },
  { code: "GH", currency: "GHS", defaultLanguage: "en" },
  { code: "GR", currency: "EUR", defaultLanguage: "en" },
  { code: "HK", currency: "HKD", defaultLanguage: "en" },
  { code: "IN", currency: "INR", defaultLanguage: "en" },
  { code: "IE", currency: "EUR", defaultLanguage: "en" },
  { code: "IT", currency: "EUR", defaultLanguage: "it" },
  { code: "JP", currency: "JPY", defaultLanguage: "en" },
  { code: "KE", currency: "KES", defaultLanguage: "en" },
  { code: "LU", currency: "EUR", defaultLanguage: "fr" },
  { code: "MX", currency: "MXN", defaultLanguage: "es" },
  { code: "MA", currency: "MAD", defaultLanguage: "fr" },
  { code: "NL", currency: "EUR", defaultLanguage: "en" },
  { code: "NZ", currency: "NZD", defaultLanguage: "en" },
  { code: "NG", currency: "NGN", defaultLanguage: "en" },
  { code: "NO", currency: "NOK", defaultLanguage: "en" },
  { code: "PL", currency: "PLN", defaultLanguage: "en" },
  { code: "PT", currency: "EUR", defaultLanguage: "pt" },
  { code: "QA", currency: "QAR", defaultLanguage: "ar" },
  { code: "SA", currency: "SAR", defaultLanguage: "ar" },
  { code: "SG", currency: "SGD", defaultLanguage: "en" },
  { code: "ZA", currency: "ZAR", defaultLanguage: "en" },
  { code: "KR", currency: "KRW", defaultLanguage: "en" },
  { code: "ES", currency: "EUR", defaultLanguage: "es" },
  { code: "SE", currency: "SEK", defaultLanguage: "en" },
  { code: "CH", currency: "CHF", defaultLanguage: "de" },
  { code: "TR", currency: "TRY", defaultLanguage: "en" },
  { code: "AE", currency: "AED", defaultLanguage: "ar" }
];

export const pinnedRegionCodes = ["AU", "CA", "GB", "US"];

export function findRegion(code: string | undefined): RegionOption {
  return regionOptions.find((region) => region.code === code?.toUpperCase()) ?? regionOptions[2]!;
}

export function findLanguage(code: string | undefined) {
  const normalized = code?.toLowerCase().split("-")[0] as LanguageCode | undefined;
  return languageOptions.find((language) => language.code === normalized) ?? languageOptions[0]!;
}
