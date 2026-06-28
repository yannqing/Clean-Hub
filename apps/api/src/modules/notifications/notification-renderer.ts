import {
  SUPPORTED_NOTIFICATION_LOCALES,
  type NotificationLocale,
  type NotificationTemplateRecord,
} from "./notifications.types.js";

export type RenderedNotification = {
  title: string;
  content: string;
  locale: string;
  fallbackUsed: boolean;
};

const TOKEN_PATTERN = /{{\s*([\w.]+)\s*}}/g;
const legacyLocaleAliases = {
  fr: [],
  en: [],
  "zh-CN": ["zh"],
} as const satisfies Record<NotificationLocale, readonly string[]>;

export function normalizeLocale(
  locale: string | null | undefined,
): NotificationLocale | null {
  if (!locale) {
    return null;
  }

  const normalized = locale.trim().replace(/_/g, "-");
  const lower = normalized.toLowerCase();

  if (!lower) {
    return null;
  }

  if (lower === "zh" || lower === "zh-cn" || lower === "zh-hans") {
    return "zh-CN";
  }

  if (lower.startsWith("fr")) {
    return "fr";
  }

  if (lower.startsWith("en")) {
    return "en";
  }

  return SUPPORTED_NOTIFICATION_LOCALES.includes(normalized as NotificationLocale)
    ? (normalized as NotificationLocale)
    : null;
}

export function buildLocaleCandidates(input: {
  requestedLocale?: string | null;
  tenantDefaultLocale?: string | null;
  fallbackLocale?: string | null;
}): string[] {
  const normalizedCandidates = [
    normalizeLocale(input.requestedLocale),
    normalizeLocale(input.tenantDefaultLocale),
    normalizeLocale(input.fallbackLocale),
    ...SUPPORTED_NOTIFICATION_LOCALES,
  ].filter(Boolean) as NotificationLocale[];

  return [
    ...new Set(
      normalizedCandidates.flatMap((locale) => [
        locale,
        ...legacyLocaleAliases[locale],
      ]),
    ),
  ];
}

export function renderNotificationTemplate(
  template: NotificationTemplateRecord,
  variables: Record<string, unknown>,
  requestedLocale?: string | null,
): RenderedNotification {
  return {
    title: renderText(template.titleTemplate, variables),
    content: renderText(template.contentTemplate, variables),
    locale: normalizeLocale(template.locale) ?? template.locale,
    fallbackUsed:
      Boolean(normalizeLocale(requestedLocale)) &&
      normalizeLocale(requestedLocale) !== normalizeLocale(template.locale),
  };
}

function renderText(template: string, variables: Record<string, unknown>): string {
  return template.replace(TOKEN_PATTERN, (_token, path: string) => {
    const value = readPath(variables, path);

    if (value === undefined || value === null) {
      return "";
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    return String(value);
  });
}

function readPath(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (
      typeof current !== "object" ||
      current === null ||
      !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, source);
}
