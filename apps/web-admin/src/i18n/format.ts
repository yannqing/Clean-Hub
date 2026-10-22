import type { WebAdminLocale } from "./locale";

type DateFormatOptions = {
  dateStyle?: "medium" | "short" | "long";
  timeStyle?: "short" | "medium";
};

function getIntlLocale(locale: WebAdminLocale): string {
  if (locale === "zh-CN") {
    return "zh-CN";
  }

  return locale === "fr" ? "fr-FR" : "en";
}

export function formatWebAdminDate(
  locale: WebAdminLocale,
  value: string,
  options: DateFormatOptions = { dateStyle: "medium" },
  timeZone?: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    ...options,
    timeZone,
  }).format(date);
}

export function formatWebAdminDateTime(
  locale: WebAdminLocale,
  value: string,
  timeZone?: string,
): string {
  return (
    formatWebAdminDate(locale, value, {
      dateStyle: "medium",
      timeStyle: "short",
    }, timeZone) || value
  );
}
