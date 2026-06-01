"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@cleanhub/ui";

import { useSaasI18n, useWebAdminLocale, type WebAdminLocale } from "@/i18n";

const localeOptions: WebAdminLocale[] = ["en", "zh-CN"];

function getLocaleLabel(
  languageLabels: ReturnType<typeof useSaasI18n>["m"]["common"]["languageLabels"],
  locale: WebAdminLocale,
): string {
  if (locale === "zh-CN") {
    return languageLabels.zhCN;
  }

  return languageLabels.en;
}

type LanguageSwitcherProps = {
  className?: string;
};

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { locale, setLocale, messages } = useWebAdminLocale();
  const { m } = useSaasI18n();

  return (
    <Select
      onValueChange={(value) => setLocale(value as WebAdminLocale)}
      value={locale}
    >
      <SelectTrigger
        aria-label={messages.common.language}
        className={cn("h-9 w-[9.5rem]", className)}
      >
        <SelectValue placeholder={messages.common.language} />
      </SelectTrigger>
      <SelectContent
        align="end"
        avoidCollisions={false}
        position="popper"
        side="bottom"
        sideOffset={4}
      >
        {localeOptions.map((option) => (
          <SelectItem key={option} value={option}>
            {getLocaleLabel(m.common.languageLabels, option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
