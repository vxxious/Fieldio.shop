import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMemo, useRef, useState, type RefObject } from "react";
import { useLocale } from "../context/LocaleContext";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { languageOptions, pinnedRegionCodes, regionOptions } from "../lib/regions";
import { CloseIcon, SearchIcon } from "./Icons";

interface RegionLanguagePanelProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}

export function RegionLanguagePanel({ isOpen, onClose, triggerRef }: RegionLanguagePanelProps) {
  const { region, language, automatic, ratesAvailable, setRegion, setLanguage, t } = useLocale();
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();
  const slideOffset = language.direction === "rtl" ? "100%" : "-100%";
  useFocusTrap(panelRef, isOpen, onClose, null, triggerRef, searchRef);

  const displayNames = useMemo(() => {
    try { return new Intl.DisplayNames([language.locale], { type: "region" }); }
    catch { return new Intl.DisplayNames(["en"], { type: "region" }); }
  }, [language.locale]);
  const normalizedQuery = query.trim().toLocaleLowerCase(language.locale);
  const regions = useMemo(() => regionOptions
    .map((option) => ({ ...option, name: displayNames.of(option.code) ?? option.code }))
    .filter((option) => !normalizedQuery || `${option.name} ${option.code} ${option.currency}`.toLocaleLowerCase(language.locale).includes(normalizedQuery)), [displayNames, language.locale, normalizedQuery]);
  const pinned = pinnedRegionCodes.flatMap((code) => regions.find((option) => option.code === code) ?? []);
  const remaining = regions.filter((option) => !pinnedRegionCodes.includes(option.code)).sort((a, b) => a.name.localeCompare(b.name, language.locale));

  const selectRegion = (code: string) => {
    setRegion(code);
    setQuery("");
  };

  return <AnimatePresence>
    {isOpen && <motion.div className="region-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.2 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.aside
        ref={panelRef}
        className="region-panel"
        data-lenis-prevent
        role="dialog"
        aria-modal="true"
        aria-labelledby="region-panel-title"
        tabIndex={-1}
        initial={reduceMotion ? false : { x: slideOffset, clipPath: "inset(0 100% 0 0)" }}
        animate={{ x: 0, clipPath: "inset(0 0% 0 0)" }}
        exit={reduceMotion ? { opacity: 0 } : { x: slideOffset, clipPath: "inset(0 100% 0 0)" }}
        transition={{ duration: reduceMotion ? 0 : 0.48, ease: [0.16, 1, 0.3, 1] }}
      >
        <header className="region-panel-header"><h2 id="region-panel-title">{t("region.title")}</h2><button className="icon-button" type="button" onClick={onClose} aria-label={t("region.close")}><CloseIcon /></button></header>
        <div className="region-search"><SearchIcon /><label className="sr-only" htmlFor="region-search">{t("region.search")}</label><input ref={searchRef} id="region-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("region.search")} autoComplete="off" />{query && <button className="text-link" type="button" onClick={() => setQuery("")}>{t("common.clear")}</button>}</div>
        <fieldset className="language-options"><legend>{t("region.language")}</legend><div>{languageOptions.map((option) => <label key={option.code} className={language.code === option.code ? "selected" : ""}><input type="radio" name="language" value={option.code} checked={language.code === option.code} onChange={() => setLanguage(option.code)} /><span lang={option.locale}>{option.name}</span></label>)}</div></fieldset>
        <p className="region-note">{automatic ? t("region.auto") : ratesAvailable ? t("region.converted") : t("region.unavailable")}</p>
        <div className="region-list" aria-label={t("region.title")}>
          {[...pinned, ...remaining].map((option, index) => <button key={option.code} type="button" className={`${region.code === option.code ? "selected" : ""}${index === pinned.length && pinned.length > 0 ? " pinned-boundary" : ""}`} onClick={() => selectRegion(option.code)}><span>{option.name}</span><span>{currencyLabel(option.currency, language.locale)}</span></button>)}
        </div>
        {!regions.length && <p className="region-empty" role="status">{t("region.noResults")}</p>}
      </motion.aside>
    </motion.div>}
  </AnimatePresence>;
}

function currencySymbol(currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 }).formatToParts(0).find((part) => part.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

function currencyLabel(currency: string, locale: string): string {
  const symbol = currencySymbol(currency, locale);
  return symbol === currency ? currency : `${currency} ${symbol}`;
}
