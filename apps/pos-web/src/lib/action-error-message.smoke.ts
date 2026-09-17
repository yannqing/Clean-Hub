import assert from "node:assert/strict";

import { setPosRuntimeLocale } from "@/components/i18n/pos-runtime-text";

import { getActionErrorMessage } from "./action-error-message";

/**
 * Server actions cannot know the cashier's locale, so they return a Chinese
 * `message` plus a locale-independent `code`. These assertions pin that the
 * client prefers the code, and that it falls back rather than showing a key
 * path or an empty toast.
 */

// 1. A known code is translated, ignoring the server's Chinese message.
setPosRuntimeLocale("fr");
assert.equal(
  getActionErrorMessage(
    { code: "ORDER_NOT_FOUND", message: "订单不存在或已被删除。" },
    "order",
  ),
  "La commande n’existe pas ou a été supprimée.",
  "a known order code must render in the active locale",
);
assert.equal(
  getActionErrorMessage(
    { code: "VERSION_CONFLICT", message: "该工单已被他人修改，请刷新后重试。" },
    "ticket",
  ),
  "Quelqu’un d’autre a modifié ce ticket. Actualisez puis réessayez.",
  "a known ticket code must render in the active locale",
);

// 2. The domain selects the table: the same code differs per resource.
setPosRuntimeLocale("en");
const orderConflict = getActionErrorMessage(
  { code: "VERSION_CONFLICT", message: "x" },
  "order",
);
const ticketConflict = getActionErrorMessage(
  { code: "VERSION_CONFLICT", message: "x" },
  "ticket",
);
assert.notEqual(
  orderConflict,
  ticketConflict,
  "VERSION_CONFLICT must read differently for an order and a ticket",
);
assert.ok(
  orderConflict.includes("order") && ticketConflict.includes("ticket"),
  `expected resource-specific wording, got ${orderConflict} / ${ticketConflict}`,
);

// 3. A code the catalogue does not carry falls back to the server message,
//    never to a key path.
const unknown = getActionErrorMessage(
  { code: "SOME_NEW_BACKEND_CODE", message: "服务端兜底消息" },
  "order",
);
assert.equal(
  unknown,
  "服务端兜底消息",
  "an unknown code must fall back to the server message",
);
assert.ok(
  !unknown.startsWith("pos.error."),
  "the fallback must never be a key path",
);

// 4. No code at all (a network error, say) also falls back.
assert.equal(
  getActionErrorMessage({ message: "网络异常" }, "order"),
  "网络异常",
  "a result without a code must fall back to the server message",
);

console.log("POS action-error-message smoke passed.");
