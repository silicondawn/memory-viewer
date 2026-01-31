import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { type Locale, translate } from "../i18n";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  toggleLocale: () => void;
  t: (key: string) => string;
}

function getInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem("mv-locale");
    if (saved === "zh" || saved === "en") return saved;
  } catch {}
  return "en";
}

export const LocaleContext = createContext<LocaleContextValue>(null!);

export function useLocaleState() {
  const [locale, setLocaleRaw] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleRaw(l);
    try { localStorage.setItem("mv-locale", l); } catch {}
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "en" ? "zh" : "en");
  }, [locale, setLocale]);

  const t = useCallback((key: string) => translate(key, locale), [locale]);

  return useMemo(() => ({ locale, setLocale, toggleLocale, t }), [locale, setLocale, toggleLocale, t]);
}

export function useLocale() {
  return useContext(LocaleContext);
}
