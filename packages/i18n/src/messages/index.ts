import { enMessages } from "./en";
import { frMessages } from "./fr";
import { zhCNMessages } from "./zh-CN";
import type { MessageCatalogs } from "./types";

export const messages = {
  fr: frMessages,
  en: enMessages,
  "zh-CN": zhCNMessages,
} as const satisfies MessageCatalogs;

export type Messages = typeof messages;
export type DefaultMessageCatalog = Messages["fr"];
