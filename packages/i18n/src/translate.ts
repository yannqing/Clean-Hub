import { defaultLocale, type SupportedLocale } from "./locales";
import { messages, type DefaultMessageCatalog } from "./messages/index";
import type { NestedMessages } from "./messages/types";

export type TranslationParams = Record<string, string | number | boolean | null | undefined>;

type LeafPaths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends NestedMessages
      ? LeafPaths<T[K], `${Prefix}${K}.`>
      : never;
}[keyof T & string];

export type TranslationKey = LeafPaths<DefaultMessageCatalog>;

export type MissingTranslationHandler = (input: {
  key: string;
  locale: SupportedLocale;
  fallbackLocale: SupportedLocale;
}) => void;

export type TranslatorOptions = {
  locale: SupportedLocale;
  fallbackLocale?: SupportedLocale;
  onMissingKey?: MissingTranslationHandler;
};

const missingWarnings = new Set<string>();

export function createTranslator(options: TranslatorOptions) {
  return (key: TranslationKey, params?: TranslationParams): string =>
    translate(key, params, options);
}

export function translate(
  key: TranslationKey,
  params: TranslationParams | undefined,
  options: TranslatorOptions,
): string {
  const fallbackLocale = options.fallbackLocale ?? defaultLocale;
  const localized = resolveMessage(messages[options.locale], key);
  const fallback = resolveMessage(messages[fallbackLocale], key);

  if (localized === null) {
    options.onMissingKey?.({
      key,
      locale: options.locale,
      fallbackLocale,
    });
    warnMissingKey(key, options.locale, fallbackLocale);
  }

  return interpolate(localized ?? fallback ?? key, params);
}

export function hasMessage(locale: SupportedLocale, key: TranslationKey): boolean {
  return resolveMessage(messages[locale], key) !== null;
}

export function listMessageKeys(
  catalog: NestedMessages,
  prefix = "",
): string[] {
  return Object.entries(catalog).flatMap(([key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;

    return typeof value === "string"
      ? [nextKey]
      : listMessageKeys(value, nextKey);
  });
}

function resolveMessage(catalog: NestedMessages, key: string): string | null {
  let current: string | NestedMessages | undefined = catalog;

  for (const segment of key.split(".")) {
    if (!current || typeof current === "string") {
      return null;
    }

    current = current[segment];
  }

  return typeof current === "string" ? current : null;
}

function interpolate(value: string, params: TranslationParams | undefined): string {
  if (!params) {
    return value;
  }

  return value.replace(/\{(\w+)\}/g, (match, key: string) => {
    const replacement = params[key];

    return replacement === null || replacement === undefined
      ? match
      : String(replacement);
  });
}

function warnMissingKey(
  key: string,
  locale: SupportedLocale,
  fallbackLocale: SupportedLocale,
): void {
  const warningKey = `${locale}:${key}`;

  if (missingWarnings.has(warningKey)) {
    return;
  }

  missingWarnings.add(warningKey);

  if (typeof console !== "undefined") {
    console.warn(
      `[i18n] Missing translation "${key}" for locale "${locale}", falling back to "${fallbackLocale}".`,
    );
  }
}
