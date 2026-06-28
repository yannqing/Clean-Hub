import type { SupportedLocale } from "../locales.js";

export type MessageNamespace = "common" | "auth" | "customer" | "delivery" | "owner";

export type NestedMessages = {
  readonly [key: string]: string | NestedMessages;
};

export type MessageCatalog = Record<MessageNamespace, NestedMessages>;

export type MessageCatalogs = Record<SupportedLocale, MessageCatalog>;
