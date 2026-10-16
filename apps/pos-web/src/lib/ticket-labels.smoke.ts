import assert from "node:assert/strict";

import { setPosRuntimeLocale } from "@/components/i18n/pos-runtime-text";

import {
  getTicketItemStatusLabel,
  getTicketItemTypeLabel,
  getTicketPriorityLabel,
  getTicketSourceLabel,
  getTicketStatusLabel,
  getTicketStatusOptions,
  getTicketTypeLabel,
} from "./ticket-labels";

/**
 * A value the catalogue does not carry must degrade to the raw wire value.
 *
 * The columns behind these enums are free text, not database enums: a live
 * ticket carries `ticket_type = 'retail'`, which is a business line elsewhere
 * in the API but not a ticket type. `translate()` returns the key path for a
 * missing entry, so without the fallback a cashier reads
 * "pos.ticket.type.retail" on screen. Typecheck cannot catch this -- the value
 * only exists in the database -- so it is pinned here.
 */
setPosRuntimeLocale("zh-CN");

assert.equal(
  getTicketTypeLabel("retail" as never),
  "retail",
  "an unknown ticket type must show the raw value, not a key path",
);
assert.equal(
  getTicketStatusLabel("not_a_status" as never),
  "not_a_status",
  "an unknown status must show the raw value",
);
assert.equal(
  getTicketItemStatusLabel("not_a_status" as never),
  "not_a_status",
  "an unknown item status must show the raw value",
);

for (const source of ["retail", "not_a_status"]) {
  assert.equal(
    getTicketTypeLabel(source as never).startsWith("pos.ticket."),
    false,
    `"${source}" must never render as a translation key path`,
  );
}

// Known values still resolve, in every locale.
const expected = {
  "zh-CN": { type: "洗衣护理", status: "处理中", item: "质检中" },
  en: { type: "Laundry", status: "In progress", item: "Quality check" },
  fr: { type: "Blanchisserie", status: "En cours", item: "Contrôle qualité" },
} as const;

for (const locale of ["zh-CN", "en", "fr"] as const) {
  setPosRuntimeLocale(locale);
  assert.equal(getTicketTypeLabel("laundry"), expected[locale].type);
  assert.equal(getTicketStatusLabel("in_progress"), expected[locale].status);
  assert.equal(getTicketItemStatusLabel("done"), expected[locale].item);
}

// The same getter must follow a language switch rather than freeze at load.
setPosRuntimeLocale("zh-CN");
const zh = getTicketPriorityLabel("critical");
setPosRuntimeLocale("en");
const en = getTicketPriorityLabel("critical");
assert.equal(zh, "最紧急");
assert.equal(en, "Critical");
assert.notEqual(zh, en, "labels must follow the runtime locale");

// Option lists carry every value, labelled in the active locale.
setPosRuntimeLocale("zh-CN");
const options = getTicketStatusOptions();
assert.equal(options.length, 7, "every ticket status must be offered");
assert.deepEqual(
  options.map((option) => option.value),
  [
    "draft",
    "pending",
    "in_progress",
    "ready_to_pick",
    "picked_up",
    "cancelled",
    "exception",
  ],
);
assert.equal(
  options.every((option) => !option.label.startsWith("pos.ticket.")),
  true,
  "no option may render as a key path",
);

// Source values that are brand names stay as they are.
assert.equal(getTicketSourceLabel("pos"), "POS");
assert.equal(getTicketItemTypeLabel("cloth"), "衣物");

console.log("POS ticket labels smoke passed.");
