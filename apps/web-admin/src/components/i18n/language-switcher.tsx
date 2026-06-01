"use client";

import { cn } from "@cleanhub/ui";

import { useWebAdminLocale, type WebAdminLocale } from "@/i18n";

const localeOptions: { value: WebAdminLocale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "zh-CN", label: "中文" },
];

type LanguageSwitcherProps = {
  className?: string;
};

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { locale, setLocale, messages } = useWebAdminLocale();

  return (
    <div
      aria-label={messages.common.language}
      className={cn(
        "inline-flex w-fit gap-1 rounded-lg border bg-muted p-1",
        className,
      )}
      role="group"
    >
      {localeOptions.map((option) => {
        const active = locale === option.value;

        return (
          <button
            aria-pressed={active}
            className={cn(
              "inline-flex h-8 min-w-[3.25rem] items-center justify-center rounded-md px-3 text-sm font-medium transition-colors",
              "hover:bg-background hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground",
            )}
            key={option.value}
            onClick={() => setLocale(option.value)}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
