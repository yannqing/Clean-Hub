"use client";

import { useMemo } from "react";
import type { SupportedLocale } from "@cleanhub/i18n";
import {
  I18nProvider,
  type LocaleStorageAdapter,
} from "@cleanhub/i18n/react";

export const posLocaleCookieName = "cleanhub.pos.locale";
const posLocaleStorageKey = "cleanhub.pos.locale";
const posDefaultLocale: SupportedLocale = "zh-CN";

type PosI18nProviderProps = {
  children: React.ReactNode;
  initialLocale?: string | null;
};

export function PosI18nProvider({
  children,
  initialLocale,
}: PosI18nProviderProps) {
  const storage = useMemo(() => createPosLocaleStorage(), []);
  const deviceLocale =
    typeof navigator === "undefined" ? null : navigator.language;

  return (
    <I18nProvider
      defaultLocale={posDefaultLocale}
      deviceLocale={deviceLocale}
      initialLocale={initialLocale}
      storage={storage}
    >
      {children}
    </I18nProvider>
  );
}

function createPosLocaleStorage(): LocaleStorageAdapter {
  return {
    async get() {
      if (typeof window === "undefined") {
        return null;
      }

      return window.localStorage.getItem(posLocaleStorageKey);
    },
    async set(locale: SupportedLocale) {
      if (typeof window === "undefined") {
        return;
      }

      window.localStorage.setItem(posLocaleStorageKey, locale);
      document.cookie = `${posLocaleCookieName}=${encodeURIComponent(
        locale,
      )}; path=/; max-age=31536000; sameSite=lax`;
    },
  };
}
