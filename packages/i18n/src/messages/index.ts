import { enMessages } from "./en.js";
import { frMessages } from "./fr.js";
import { zhCNMessages } from "./zh-CN.js";
import type { MessageCatalogs } from "./types.js";

export const messages = {
  fr: frMessages,
  en: enMessages,
  "zh-CN": zhCNMessages,
} as const satisfies MessageCatalogs;

export type Messages = typeof messages;
export type DefaultMessageCatalog = Messages["fr"];
