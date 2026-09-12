import { findLanguage, findRegion, type LanguageCode } from "./regions";

export interface LocalePreference {
  region: string;
  language: LanguageCode;
}

export function detectBrowserPreference(locale = "en-GB"): LocalePreference {
  let regionCode: string | undefined;
  try {
    regionCode = new Intl.Locale(locale).region;
  } catch {
    regionCode = undefined;
  }
  const region = findRegion(regionCode);
  const language = findLanguage(locale);
  return { region: region.code, language: language.code === "en" && !locale.toLowerCase().startsWith("en") ? region.defaultLanguage : language.code };
}

export function convertCurrencyAmount(value: number, source: string, target: string, rates: Record<string, number>, base = "GBP"): number | null {
  if (source === target) return value;
  const sourceRate = source === base ? 1 : rates[source];
  const targetRate = target === base ? 1 : rates[target];
  if (!sourceRate || !targetRate || !Number.isFinite(sourceRate) || !Number.isFinite(targetRate)) return null;
  return (value / sourceRate) * targetRate;
}

export function formatLocalizedPrice(value: number | null, sourceCurrency: string, targetCurrency: string, locale: string, rates: Record<string, number>): string {
  if (value === null) return "Price on request";
  const sourceMajor = value / 100;
  const converted = convertCurrencyAmount(sourceMajor, sourceCurrency, targetCurrency, rates);
  const amount = converted ?? sourceMajor;
  const currency = converted === null ? sourceCurrency : targetCurrency;
  return new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 2 }).format(amount);
}
