export {
  defaultLocale,
  isSupportedLocale,
  localeLabels,
  localeStorageKey,
  normalizeLocale,
  resolveLocale,
  supportedLocales,
  type SupportedLocale,
} from "./locales.js";
export { messages, type Messages } from "./messages/index.js";
export {
  createTranslator,
  hasMessage,
  listMessageKeys,
  translate,
  type MissingTranslationHandler,
  type TranslationKey,
  type TranslationParams,
  type TranslatorOptions,
} from "./translate.js";

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
  import("./locales.js").SupportedLocale,
  Record<"laundry" | "car_wash" | "retail" | "delivery", string>
>;
