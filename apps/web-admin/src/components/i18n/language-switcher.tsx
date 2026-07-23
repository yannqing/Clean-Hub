"use client";

import {
  Icon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@cleanhub/ui";
import { Languages } from "lucide-react";

import { useWebAdminLocale, type WebAdminLocale } from "@/i18n";

const localeOptions: WebAdminLocale[] = ["en", "zh-CN"];

function getLocaleLabel(
  languageLabels: ReturnType<
    typeof useWebAdminLocale
  >["messages"]["common"]["languageLabels"],
  locale: WebAdminLocale,
): string {
  if (locale === "zh-CN") {
    return languageLabels.zhCN;
  }

  return languageLabels.en;
}

type LanguageSwitcherProps = {
  className?: string;
  iconOnly?: boolean;
};

export function LanguageSwitcher({
  className,
  iconOnly = false,
}: LanguageSwitcherProps) {
  const { locale, setLocale, messages } = useWebAdminLocale();

  return (
    <Select
      onValueChange={(value) => setLocale(value as WebAdminLocale)}
      value={locale}
    >
      <SelectTrigger
        aria-label={messages.common.language}
        className={cn(
          iconOnly
            ? "size-9 justify-center px-0 [&>svg:last-child]:hidden"
            : "h-9 w-[9.5rem]",
          className,
        )}
        title={messages.common.language}
      >
        <Icon icon={Languages} aria-hidden="true" />
        {iconOnly ? null : (
          <SelectValue placeholder={messages.common.language} />
        )}
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
            {getLocaleLabel(messages.common.languageLabels, option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
