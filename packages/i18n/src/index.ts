export {
  defaultLocale,
  isSupportedLocale,
  localeLabels,
  localeStorageKey,
  normalizeLocale,
  resolveLocale,
  supportedLocales,
  type SupportedLocale,
} from "./locales";
export { messages, type Messages } from "./messages/index";
export { getLocalizedCountryName, isoCountryCodes } from "./countries";
export {
  createTranslator,
  hasMessage,
  listMessageKeys,
  translate,
  type MissingTranslationHandler,
  type TranslationKey,
  type TranslationParams,
  type TranslatorOptions,
} from "./translate";

export const businessLineLabels = {
  en: {
    laundry: "Laundry",
    car_wash: "Car wash",
    retail: "Retail",
    delivery: "Delivery",
  },
  fr: {
    laundry: "Blanchisserie",
    car_wash: "Lavage auto",
    retail: "Vente",
    delivery: "Livraison",
  },
  "zh-CN": {
    laundry: "洗衣",
    car_wash: "洗车",
    retail: "零售",
    delivery: "配送",
  },
} as const satisfies Record<
  import("./locales").SupportedLocale,
  Record<"laundry" | "car_wash" | "retail" | "delivery", string>
>;
