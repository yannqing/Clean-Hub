"use client";

import { localeLabels, supportedLocales, type SupportedLocale } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import { Languages } from "lucide-react";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();

  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur">
      <Languages className="ml-2 size-4 text-slate-500" aria-hidden="true" />
      <span className="sr-only">{t("common.language")}</span>
      {supportedLocales.map((option) => (
        <button
          aria-pressed={locale === option}
          className={`h-8 rounded px-2 text-xs font-semibold transition ${
            locale === option
              ? "bg-teal-700 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
          key={option}
          type="button"
          onClick={() => {
            void setLocale(option as SupportedLocale);
          }}
        >
          {localeLabels[option]}
        </button>
      ))}
    </div>
  );
}
