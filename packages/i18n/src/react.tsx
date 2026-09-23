"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  defaultLocale,
  resolveLocale,
  type SupportedLocale,
} from "./locales.js";
import {
  translate,
  type TranslationKey,
  type TranslationParams,
} from "./translate.js";

export type LocaleStorageAdapter = {
  get(): Promise<string | null>;
  set(locale: SupportedLocale): Promise<void>;
};

export type I18nContextValue = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => Promise<void>;
  t: (key: TranslationKey, params?: TranslationParams) => string;
};

export type I18nProviderProps = {
  children: ReactNode;
  defaultLocale?: SupportedLocale;
  initialLocale?: string | null;
  tenantDefaultLocale?: string | null;
  deviceLocale?: string | null;
  storage?: LocaleStorageAdapter;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  defaultLocale: fallback = defaultLocale,
  initialLocale,
  tenantDefaultLocale,
  deviceLocale,
  storage,
}: I18nProviderProps) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() =>
    resolveLocale({
      userPreference: initialLocale,
      tenantDefault: tenantDefaultLocale,
      deviceLocale,
      defaultLocale: fallback,
    }),
  );

  useEffect(() => {
    let mounted = true;

    void storage?.get().then((storedLocale) => {
      if (!mounted) {
        return;
      }

      setLocaleState(
        resolveLocale({
          // A device locale becomes available only after a WebView hydrates.
          // Fall back to it when the customer has not picked a language yet.
          userPreference: storedLocale ?? initialLocale,
          tenantDefault: tenantDefaultLocale,
          deviceLocale,
          defaultLocale: fallback,
        }),
      );
    });

    return () => {
      mounted = false;
    };
  }, [deviceLocale, fallback, initialLocale, storage, tenantDefaultLocale]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback(
    async (nextLocale: SupportedLocale) => {
      setLocaleState(nextLocale);
      await storage?.set(nextLocale);
    },
    [storage],
  );

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) =>
      translate(key, params, {
        locale,
        fallbackLocale: fallback,
      }),
    [fallback, locale],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const value = useContext(I18nContext);

  if (!value) {
    throw new Error("useTranslation must be used inside I18nProvider.");
  }

  return value;
}
