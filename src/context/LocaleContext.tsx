import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { detectBrowserPreference, formatLocalizedPrice, type LocalePreference } from "../lib/localization";
import { findLanguage, findRegion, type LanguageCode } from "../lib/regions";
import { translate, type TranslationKey } from "../lib/translations";

const storageKey = "fieldio-locale-v1";

interface LocaleContextValue {
  region: ReturnType<typeof findRegion>;
  language: ReturnType<typeof findLanguage>;
  automatic: boolean;
  ratesAvailable: boolean;
  setRegion: (code: string) => void;
  setLanguage: (code: LanguageCode) => void;
  formatMoney: (value: number | null, sourceCurrency: string) => string;
  t: (key: TranslationKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readStoredPreference(): LocalePreference | null {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "null") as Partial<LocalePreference> | null;
    if (!value?.region || !value.language) return null;
    return { region: findRegion(value.region).code, language: findLanguage(value.language).code };
  } catch {
    return null;
  }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const stored = useMemo(() => readStoredPreference(), []);
  const browser = useMemo(() => detectBrowserPreference(navigator.language), []);
  const [preference, setPreference] = useState<LocalePreference>(stored ?? browser);
  const [automatic, setAutomatic] = useState(!stored);
  const [rates, setRates] = useState<Record<string, number>>({ GBP: 1 });
  const [ratesAvailable, setRatesAvailable] = useState(true);
  const region = findRegion(preference.region);
  const language = findLanguage(preference.language);

  useEffect(() => {
    document.documentElement.lang = language.locale;
    document.documentElement.dir = language.direction;
  }, [language.direction, language.locale]);

  useEffect(() => {
    if (stored) return;
    const controller = new AbortController();
    fetch("/api/locale", { signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<{ country?: string; language?: string }> : null)
      .then((detected) => {
        if (!detected?.country) return;
        const detectedRegion = findRegion(detected.country);
        const detectedLanguage = findLanguage(detected.language);
        setPreference({ region: detectedRegion.code, language: detectedLanguage.code === "en" && !detected.language?.toLowerCase().startsWith("en") ? detectedRegion.defaultLanguage : detectedLanguage.code });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [stored]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/rates?base=GBP", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Rates unavailable");
        return response.json() as Promise<{ rates: Record<string, number> }>;
      })
      .then((result) => { setRates({ ...result.rates, GBP: 1 }); setRatesAvailable(true); })
      .catch(() => setRatesAvailable(false));
    return () => controller.abort();
  }, []);

  const persist = useCallback((next: LocalePreference) => {
    setPreference(next);
    setAutomatic(false);
    localStorage.setItem(storageKey, JSON.stringify(next));
  }, []);

  const setRegion = useCallback((code: string) => {
    const nextRegion = findRegion(code);
    persist({ region: nextRegion.code, language: nextRegion.defaultLanguage });
  }, [persist]);
  const setLanguage = useCallback((code: LanguageCode) => persist({ ...preference, language: findLanguage(code).code }), [persist, preference]);
  const formatMoney = useCallback((value: number | null, sourceCurrency: string) => {
    if (value === null) return translate(language.code, "product.priceRequest");
    return formatLocalizedPrice(value, sourceCurrency, region.currency, language.locale, rates);
  }, [language.code, language.locale, rates, region.currency]);
  const t = useCallback((key: TranslationKey) => translate(language.code, key), [language.code]);

  const value = useMemo<LocaleContextValue>(() => ({ region, language, automatic, ratesAvailable, setRegion, setLanguage, formatMoney, t }), [automatic, formatMoney, language, ratesAvailable, region, setLanguage, setRegion, t]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used within LocaleProvider");
  return value;
}
