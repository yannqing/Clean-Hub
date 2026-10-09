import assert from "node:assert/strict";

import { setPosRuntimeLocale } from "@/components/i18n/pos-runtime-text";

import {
  getCustomerColumnLabel,
  getCustomerStateLabel,
} from "./customer-labels";
import {
  getNoticePriorityLabel,
  getNoticePriorityOptions,
  getNoticeReadStatusLabel,
  getNoticeReadStatusOptions,
  getNoticeRelatedTypeLabel,
  getNoticeRelatedTypeOptions,
  getNoticeTypeLabel,
  getNoticeTypeOptions,
} from "./notice-labels";
import { getTicketColumnLabel } from "./ticket-labels";

for (const locale of ["zh-CN", "en", "fr"] as const) {
  setPosRuntimeLocale(locale);

  for (const type of ["business", "system"] as const) {
    const value = getNoticeTypeLabel(type);
    assert.ok(
      value && !value.startsWith("pos."),
      `${locale}: notice type ${type} resolved to ${value}`,
    );
  }
  for (const status of ["unread", "read", "archived"] as const) {
    const value = getNoticeReadStatusLabel(status);
    assert.ok(
      value && !value.startsWith("pos."),
      `${locale}: read status ${status} resolved to ${value}`,
    );
  }
  for (const priority of ["low", "normal", "high", "critical"] as const) {
    const value = getNoticePriorityLabel(priority);
    assert.ok(
      value && !value.startsWith("pos."),
      `${locale}: priority ${priority} resolved to ${value}`,
    );
  }
  for (const related of ["order", "ticket"] as const) {
    const value = getNoticeRelatedTypeLabel(related);
    assert.ok(
      value && !value.startsWith("pos."),
      `${locale}: related type ${related} resolved to ${value}`,
    );
  }
  for (const column of [
    "customer",
    "contact",
    "account",
    "status",
    "createdAt",
    "actions",
  ]) {
    const value = getCustomerColumnLabel(column);
    assert.ok(
      value && !value.startsWith("pos."),
      `${locale}: customer column ${column} resolved to ${value}`,
    );
  }
  for (const state of ["active", "disabled"] as const) {
    const value = getCustomerStateLabel(state);
    assert.ok(
      value && !value.startsWith("pos."),
      `${locale}: customer state ${state} resolved to ${value}`,
    );
  }
  for (const column of [
    "ticket",
    "account",
    "customer",
    "type",
    "status",
    "priority",
    "pickup",
  ]) {
    const value = getTicketColumnLabel(column);
    assert.ok(
      value && !value.startsWith("pos."),
      `${locale}: ticket column ${column} resolved to ${value}`,
    );
  }
}

/**
 * The priority filter is ordered critical-first on purpose -- that is the one
 * a cashier reaches for -- so it must not silently fall back to enum order.
 */
setPosRuntimeLocale("fr");
assert.deepEqual(
  getNoticePriorityOptions().map((option) => option.value),
  ["critical", "high", "normal", "low"],
  "the priority filter must stay ordered critical-first",
);
assert.deepEqual(
  getNoticeTypeOptions().map((option) => option.value),
  ["business", "system"],
  "notice type options must keep their declared order",
);
assert.deepEqual(
  getNoticeReadStatusOptions().map((option) => option.value),
  ["unread", "read", "archived"],
  "read status options must keep their declared order",
);
assert.deepEqual(
  getNoticeRelatedTypeOptions().map((option) => option.value),
  ["order", "ticket"],
  "related type options must keep their declared order",
);

// Options carry translated labels, not enum values.
const frPriority = getNoticePriorityOptions();
setPosRuntimeLocale("zh-CN");
const zhPriority = getNoticePriorityOptions();
assert.notEqual(
  frPriority[0].label,
  zhPriority[0].label,
  "the French and Chinese labels for `critical` must differ",
);

// An unknown column degrades to the raw value, never a key path.
setPosRuntimeLocale("fr");
assert.equal(
  getCustomerColumnLabel("not_a_column"),
  "not_a_column",
  "an unknown customer column must show the raw value",
);
assert.equal(
  getTicketColumnLabel("not_a_column"),
  "not_a_column",
  "an unknown ticket column must show the raw value",
);

console.log("POS notice/customer/ticket-column labels smoke passed.");
