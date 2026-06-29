"use client";

import { useMemo } from "react";
import {
  defaultLocale,
  localeStorageKey,
  type SupportedLocale,
} from "@cleanhub/i18n";
import {
  I18nProvider,
  type LocaleStorageAdapter,
} from "@cleanhub/i18n/react";

type MobileI18nProviderProps = {
  children: React.ReactNode;
};

export function MobileI18nProvider({ children }: MobileI18nProviderProps) {
  const storage = useMemo(() => createMobileLocaleStorage(), []);
  const deviceLocale =
    typeof navigator === "undefined" ? null : navigator.language;

  return (
    <I18nProvider
      defaultLocale={defaultLocale}
      deviceLocale={deviceLocale}
      storage={storage}
    >
      {children}
    </I18nProvider>
  );
}

function createMobileLocaleStorage(
  key = localeStorageKey,
): LocaleStorageAdapter {
  return {
    async get() {
      if (typeof window === "undefined") {
        return null;
      }

      try {
        const preferences = await import("@capacitor/preferences");
        const result = await preferences.Preferences.get({ key });
        return result.value;
      } catch {
        return window.localStorage.getItem(key);
      }
    },
    async set(locale: SupportedLocale) {
      if (typeof window === "undefined") {
        return;
      }

      try {
        const preferences = await import("@capacitor/preferences");
        await preferences.Preferences.set({ key, value: locale });
      } catch {
        window.localStorage.setItem(key, locale);
      }
    },
  };
}
