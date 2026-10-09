import assert from "node:assert/strict";

import { setPosRuntimeLocale } from "@/components/i18n/pos-runtime-text";

import {
  getOrderColumnLabel,
  getOrderPaymentStatusLabel,
  getOrderPeriodLabel,
  getOrderSortLabel,
  getOrderStatusLabel,
  getOrderTypeLabel,
  getPaymentMethodLabel,
  getPaymentTransactionStatusLabel,
  ORDER_PAYMENT_STATUS_VALUES,
  ORDER_SORT_VALUES,
  ORDER_STATUS_VALUES,
  ORDER_TYPE_VALUES,
} from "./order-labels";

/**
 * These labels replaced three drifted copies of the same vocabulary: the
 * orders feature said 待支付 for `received` while the customers feature said
 * 已接收, and `manual` was 普通订单 on one screen and 手动订单 on another.
 * One catalogue now backs all of them, so the wording cannot drift again --
 * but only while every caller goes through these accessors.
 */

// 1. Every enum value resolves in every locale, and never to a key path.
for (const locale of ["zh-CN", "en", "fr"] as const) {
  setPosRuntimeLocale(locale);

  for (const status of ORDER_STATUS_VALUES) {
    const label = getOrderStatusLabel(status);
    assert.ok(
      label && !label.startsWith("pos.order."),
      `${locale}: order status ${status} resolved to ${label}`,
    );
  }
  for (const status of ORDER_PAYMENT_STATUS_VALUES) {
    const label = getOrderPaymentStatusLabel(status);
    assert.ok(
      label && !label.startsWith("pos.order."),
      `${locale}: payment status ${status} resolved to ${label}`,
    );
  }
  for (const type of ORDER_TYPE_VALUES) {
    const label = getOrderTypeLabel(type);
    assert.ok(
      label && !label.startsWith("pos.order."),
      `${locale}: order type ${type} resolved to ${label}`,
    );
  }
  for (const sort of ORDER_SORT_VALUES) {
    const label = getOrderSortLabel(sort);
    assert.ok(
      label && !label.startsWith("pos.order."),
      `${locale}: sort ${sort} resolved to ${label}`,
    );
  }
  for (const period of ["all", "today", "week", "month"] as const) {
    const label = getOrderPeriodLabel(period);
    assert.ok(
      label && !label.startsWith("pos.order."),
      `${locale}: period ${period} resolved to ${label}`,
    );
  }
  for (const method of ["cash", "card", "app"] as const) {
    const label = getPaymentMethodLabel(method);
    assert.ok(
      label && !label.startsWith("pos.order."),
      `${locale}: payment method ${method} resolved to ${label}`,
    );
  }
  for (const status of ["pending", "paid", "refunded", "failed"] as const) {
    const label = getPaymentTransactionStatusLabel(status);
    assert.ok(
      label && !label.startsWith("pos.order."),
      `${locale}: transaction status ${status} resolved to ${label}`,
    );
  }
  for (const column of [
    "order",
    "customer",
    "amount",
    "status",
    "payment",
    "createdAt",
  ]) {
    const label = getOrderColumnLabel(column);
    assert.ok(
      label && !label.startsWith("pos.order."),
      `${locale}: column ${column} resolved to ${label}`,
    );
  }
}

// 2. The labels actually differ per locale -- a catalogue that silently
//    fell back to one language would still pass the check above.
setPosRuntimeLocale("fr");
const frPaid = getOrderStatusLabel("paid");
setPosRuntimeLocale("zh-CN");
const zhPaid = getOrderStatusLabel("paid");
assert.notEqual(
  frPaid,
  zhPaid,
  "the French and Chinese labels for `paid` must differ",
);

// 3. An unknown value degrades to the raw value, not a key path. The status
//    columns are free text on the wire, so this can reach a real screen.
setPosRuntimeLocale("fr");
assert.equal(
  getOrderStatusLabel("not_a_status"),
  "not_a_status",
  "an unknown order status must show the raw value, not a key path",
);
assert.equal(
  getOrderColumnLabel("not_a_column"),
  "not_a_column",
  "an unknown column must show the raw value, not a key path",
);

console.log("POS order-labels smoke passed.");
