"use client";

import {
  localeLabels,
  supportedLocales,
  type SupportedLocale,
} from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@cleanhub/ui";

import { Icon } from "@/components/app-shell/icons";

type LanguageSwitcherProps = {
  className?: string;
  compact?: boolean;
  fullWidth?: boolean;
  variant?: "default" | "dark";
};

export function LanguageSwitcher({
  className,
  compact = false,
  fullWidth = false,
  variant = "default",
}: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={cn("relative", fullWidth && "w-full", className)}
    >
      <button
        aria-expanded={open}
        aria-label={t("pos.language.switcherLabel")}
        className={cn(
          "flex items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition",
          variant === "dark" ? "h-9" : "h-10",
          compact
            ? variant === "dark"
              ? "w-9 px-0 2xl:w-auto 2xl:px-3"
              : "w-10 px-0 2xl:w-auto 2xl:px-3"
            : "px-3",
          fullWidth && "w-full justify-between",
          variant === "dark"
            ? "border-transparent bg-transparent text-white/75 hover:bg-white/10 hover:text-white"
            : "border-border bg-background text-foreground hover:bg-muted",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Icon
          className={cn(
            "h-4 w-4",
            variant === "dark" ? "text-white/65" : "text-muted-foreground",
          )}
          name="languages"
        />
        <span className={cn(compact && "hidden 2xl:inline")}>
          {localeLabels[locale]}
        </span>
        <Icon
          className={cn(
            "h-3.5 w-3.5 transition",
            compact && "hidden 2xl:block",
            variant === "dark" ? "text-white/45" : "text-muted-foreground",
            open ? "rotate-180" : "",
          )}
          name="chevron-down"
        />
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-[60] w-40 rounded-lg border border-border bg-background p-1 text-foreground shadow-lg">
          {supportedLocales.map((option) => {
            const selected = option === locale;

            return (
              <button
                aria-pressed={selected}
                className={cn(
                  "flex h-10 w-full items-center justify-between rounded-md px-3 text-sm font-medium transition-colors",
                  selected
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
                key={option}
                onClick={() => {
                  void setLocale(option as SupportedLocale);
                  setOpen(false);
                }}
                type="button"
              >
                <span>{localeLabels[option]}</span>
                {selected ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
