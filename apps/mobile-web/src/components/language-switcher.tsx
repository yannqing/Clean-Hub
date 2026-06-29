"use client";

import { useState } from "react";
import { localeLabels, supportedLocales, type SupportedLocale } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import { Check, ChevronDown, Languages } from "lucide-react";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`relative rounded-md border border-slate-200 bg-white/95 shadow-sm backdrop-blur ${className}`}
    >
      <button
        aria-expanded={open}
        className="flex h-11 w-full items-center gap-3 px-3 text-left text-sm font-semibold text-slate-700"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <Languages className="size-4 text-slate-500" aria-hidden="true" />
        <span className="min-w-0 flex-1">{t("common.language")}</span>
        <span className="shrink-0 text-slate-500">{localeLabels[locale]}</span>
        <ChevronDown
          className={`size-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-full min-w-44 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
          {supportedLocales.map((option) => {
            const isActive = locale === option;

            return (
              <button
                aria-pressed={isActive}
                className={`flex h-10 w-full items-center justify-between rounded px-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-teal-50 text-teal-800"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
                key={option}
                type="button"
                onClick={() => {
                  void setLocale(option as SupportedLocale);
                  setOpen(false);
                }}
              >
                {localeLabels[option]}
                {isActive ? <Check className="size-4" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
