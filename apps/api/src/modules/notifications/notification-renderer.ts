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

export function normalizeLocale(locale: string | null | undefined): string | null {
  if (!locale) {
    return null;
  }

  const normalized = locale.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  const short = normalized.split("-")[0];

  return SUPPORTED_NOTIFICATION_LOCALES.includes(short as NotificationLocale)
    ? short
    : null;
}

export function buildLocaleCandidates(input: {
  requestedLocale?: string | null;
  tenantDefaultLocale?: string | null;
  fallbackLocale?: string | null;
}): string[] {
  const candidates = [
    normalizeLocale(input.requestedLocale),
    normalizeLocale(input.tenantDefaultLocale),
    normalizeLocale(input.fallbackLocale),
    ...SUPPORTED_NOTIFICATION_LOCALES,
  ].filter(Boolean) as string[];

  return [...new Set(candidates)];
}

export function renderNotificationTemplate(
  template: NotificationTemplateRecord,
  variables: Record<string, unknown>,
  requestedLocale?: string | null,
): RenderedNotification {
  return {
    title: renderText(template.titleTemplate, variables),
    content: renderText(template.contentTemplate, variables),
    locale: template.locale,
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
