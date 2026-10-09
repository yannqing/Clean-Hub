"use client";

import { useMemo } from "react";
import type { SupportedLocale } from "@cleanhub/i18n";
import {
  I18nProvider,
  useTranslation,
  type LocaleStorageAdapter,
} from "@cleanhub/i18n/react";

import { setPosRuntimeLocale } from "./pos-runtime-text";

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

  return (
    <I18nProvider
      defaultLocale={posDefaultLocale}
      initialLocale={initialLocale}
      storage={storage}
    >
      <PosRuntimeLocaleBridge>{children}</PosRuntimeLocaleBridge>
    </I18nProvider>
  );
}

function PosRuntimeLocaleBridge({ children }: { children: React.ReactNode }) {
  const { locale } = useTranslation();
  setPosRuntimeLocale(locale);
  return <>{children}</>;
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
