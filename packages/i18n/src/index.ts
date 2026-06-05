export const supportedLocales = ["en", "fr", "zh-CN"] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

export const defaultLocale: SupportedLocale = "en";

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
  SupportedLocale,
  Record<"laundry" | "car_wash" | "retail" | "delivery", string>
>;

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (supportedLocales as readonly string[]).includes(value);
}
