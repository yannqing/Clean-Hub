"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { webAdminMessages } from "./messages";
import {
  parseWebAdminLocale,
  webAdminDefaultLocale,
  webAdminLocaleCookieName,
  type WebAdminLocale,
} from "./locale";

type WebAdminLocaleContextValue = {
  locale: WebAdminLocale;
  setLocale: (locale: WebAdminLocale) => void;
  messages: (typeof webAdminMessages)[WebAdminLocale];
};

const WebAdminLocaleContext = createContext<WebAdminLocaleContextValue | null>(
  null,
);

function readLocaleFromCookie(): WebAdminLocale {
  if (typeof document === "undefined") {
    return webAdminDefaultLocale;
  }

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${webAdminLocaleCookieName}=([^;]*)`),
  );

  return parseWebAdminLocale(match?.[1] ? decodeURIComponent(match[1]) : null);
}

function writeLocaleCookie(locale: WebAdminLocale): void {
  const maxAgeSeconds = 60 * 60 * 24 * 365;
  document.cookie = `${webAdminLocaleCookieName}=${encodeURIComponent(locale)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
}

type WebAdminLocaleProviderProps = {
  children: React.ReactNode;
};

export function WebAdminLocaleProvider({ children }: WebAdminLocaleProviderProps) {
  const [locale, setLocaleState] = useState<WebAdminLocale>(webAdminDefaultLocale);

  useEffect(() => {
    setLocaleState(readLocaleFromCookie());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "zh-CN" ? "zh-CN" : "en";
  }, [locale]);

  const setLocale = useCallback((nextLocale: WebAdminLocale) => {
    setLocaleState(nextLocale);
    writeLocaleCookie(nextLocale);
  }, []);

  const value = useMemo<WebAdminLocaleContextValue>(
    () => ({
      locale,
      setLocale,
      messages: webAdminMessages[locale],
    }),
    [locale, setLocale],
  );

  return (
    <WebAdminLocaleContext.Provider value={value}>
      {children}
    </WebAdminLocaleContext.Provider>
  );
}

export function useWebAdminLocale(): WebAdminLocaleContextValue {
  const context = useContext(WebAdminLocaleContext);

  if (!context) {
    throw new Error("useWebAdminLocale must be used within WebAdminLocaleProvider.");
  }

  return context;
}
