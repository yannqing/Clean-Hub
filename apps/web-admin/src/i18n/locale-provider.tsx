"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { getWebAdminMessages, webAdminDefaultMessages } from "./messages";
import type { WebAdminMessages } from "./messages-types";
import {
  getWebAdminHtmlLang,
  parseWebAdminLocale,
  webAdminDefaultLocale,
  webAdminLocaleCookieName,
  type WebAdminLocale,
} from "./locale";

type WebAdminLocaleContextValue = {
  locale: WebAdminLocale;
  setLocale: (locale: WebAdminLocale) => void;
  messages: WebAdminMessages;
  /** True while a non-default locale's message bundle is being loaded. */
  loading: boolean;
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

function resolveInitialLocale(initialLocale?: WebAdminLocale): WebAdminLocale {
  if (initialLocale) {
    return initialLocale;
  }

  return readLocaleFromCookie();
}

type WebAdminLocaleProviderProps = {
  children: React.ReactNode;
  initialLocale?: WebAdminLocale;
  /**
   * Server-injected message bundle for {@link initialLocale}. When provided,
   * the first paint uses the correct locale's copy without waiting for a
   * client-side chunk to load. Falls back to the default (en) bundle.
   */
  initialMessages?: WebAdminMessages;
};

export function WebAdminLocaleProvider({
  children,
  initialLocale,
  initialMessages,
}: WebAdminLocaleProviderProps) {
  const [locale, setLocaleState] = useState<WebAdminLocale>(() =>
    resolveInitialLocale(initialLocale),
  );
  // Start from the server-injected bundle (or the default en fallback). This
  // keeps `messages` synchronous so consumers can read strings during render.
  const [messages, setMessages] = useState<WebAdminMessages>(
    () => initialMessages ?? webAdminDefaultMessages,
  );
  // We're only "loading" on mount when we have a non-default initial locale
  // whose bundle the server did NOT inject — a rare edge case, since
  // `app/layout.tsx` normally passes `initialMessages`. Deriving this upfront
  // avoids a synchronous `setState` inside the hydrate effect.
  const [loading, setLoading] = useState(
    () => !initialMessages && locale !== webAdminDefaultLocale,
  );
  // Guards against a slow locale switch being applied after a newer one.
  const pendingLocaleRef = useRef<WebAdminLocale | null>(
    !initialMessages && locale !== webAdminDefaultLocale ? locale : null,
  );

  useEffect(() => {
    document.documentElement.lang = getWebAdminHtmlLang(locale);
  }, [locale]);

  // If the server injected a non-default initial locale but no matching
  // initial bundle, hydrate it on mount (rare — layout normally passes both).
  useEffect(() => {
    if (initialMessages) {
      return;
    }

    if (locale === webAdminDefaultLocale) {
      return;
    }

    let active = true;

    getWebAdminMessages(locale)
      .then((bundle) => {
        if (active && pendingLocaleRef.current === locale) {
          setMessages(bundle);
          setLoading(false);
          pendingLocaleRef.current = null;
        }
      })
      .catch(() => {
        if (active && pendingLocaleRef.current === locale) {
          // Keep the previous bundle on failure rather than blanking the UI.
          setLoading(false);
          pendingLocaleRef.current = null;
        }
      });

    return () => {
      active = false;
    };
  }, [initialMessages, locale]);

  const setLocale = useCallback((nextLocale: WebAdminLocale) => {
    setLocaleState(nextLocale);
    writeLocaleCookie(nextLocale);

    // No need to load anything when switching to the default locale — its
    // bundle is always present (it's the SSR/first-paint fallback).
    if (nextLocale === webAdminDefaultLocale) {
      setMessages(webAdminDefaultMessages);
      setLoading(false);
      pendingLocaleRef.current = null;
      return;
    }

    // Same bundle already loaded: nothing to fetch.
    if (pendingLocaleRef.current === nextLocale) {
      return;
    }

    pendingLocaleRef.current = nextLocale;
    setLoading(true);

    getWebAdminMessages(nextLocale)
      .then((bundle) => {
        if (pendingLocaleRef.current === nextLocale) {
          setMessages(bundle);
          setLoading(false);
          pendingLocaleRef.current = null;
        }
      })
      .catch(() => {
        if (pendingLocaleRef.current === nextLocale) {
          // Keep showing the previous locale on failure.
          setLoading(false);
          pendingLocaleRef.current = null;
        }
      });
  }, []);

  const value = useMemo<WebAdminLocaleContextValue>(
    () => ({
      locale,
      setLocale,
      messages,
      loading,
    }),
    [locale, setLocale, messages, loading],
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
