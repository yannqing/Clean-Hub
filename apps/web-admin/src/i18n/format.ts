import type { WebAdminLocale } from "./locale";

type DateFormatOptions = {
  dateStyle?: "medium" | "short" | "long";
  timeStyle?: "short" | "medium";
};

function getIntlLocale(locale: WebAdminLocale): string {
  return locale === "zh-CN" ? "zh-CN" : "en";
}

export function formatWebAdminDate(
  locale: WebAdminLocale,
  value: string,
  options: DateFormatOptions = { dateStyle: "medium" },
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(getIntlLocale(locale), options).format(date);
}

export function formatWebAdminDateTime(
  locale: WebAdminLocale,
  value: string,
): string {
  return (
    formatWebAdminDate(locale, value, {
      dateStyle: "medium",
      timeStyle: "short",
    }) || value
  );
}
