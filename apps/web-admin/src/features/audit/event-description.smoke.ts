import assert from "node:assert/strict";

import { enMessages } from "@/i18n/messages/en";
import { frMessages } from "@/i18n/messages/fr";
import { zhCNMessages } from "@/i18n/messages/zh-CN";

import {
  AUDIT_EVENT_DICTIONARY,
  UNDESCRIBED_AUDIT_EVENT_TYPES,
  getAuditEventDescription,
  getAuditEventTypesByCategory,
} from "./event-description";

const BUNDLES = [
  ["en", enMessages],
  ["fr", frMessages],
  ["zh-CN", zhCNMessages],
] as const;

const describedEvents = Object.values(AUDIT_EVENT_DICTIONARY).flat();

assert.ok(
  describedEvents.length > 0,
  "the dictionary must route at least one event",
);

// `Record<AuditEventCode, string>` already forces every bundle to carry every
// code, so the smoke guards what the type cannot: that the wording is real
// rather than an empty string or the humanised code sneaking through.
for (const [locale, messages] of BUNDLES) {
  const copy = messages.common.auditEvents;

  for (const eventType of describedEvents) {
    const label = getAuditEventDescription(eventType, copy);

    assert.notEqual(
      label.trim(),
      "",
      `${eventType} has empty ${locale} wording`,
    );
    assert.notEqual(
      label,
      getAuditEventDescription(eventType),
      `${eventType} falls back to its humanised code in ${locale}`,
    );
  }

  // Categories are typed the same way; the same reasoning applies.
  for (const category of Object.keys(AUDIT_EVENT_DICTIONARY)) {
    const label =
      messages.common.auditCategories[
        category as keyof typeof messages.common.auditCategories
      ];
    assert.notEqual(
      label?.trim(),
      "",
      `${category} has empty ${locale} wording`,
    );
  }
}

// The deliberately undescribed events must stay out of the catalogue rather
// than pick up a confident guess. They are listed so the gap stays visible.
for (const eventType of UNDESCRIBED_AUDIT_EVENT_TYPES) {
  assert.equal(
    describedEvents.includes(eventType as never),
    false,
    `${eventType} is listed as undescribed but is routed; remove it from the list`,
  );
  assert.equal(
    getAuditEventDescription(eventType, enMessages.common.auditEvents),
    eventType
      .replace(/[._]/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase()),
    `${eventType} must read as its humanised code`,
  );
}

// An unknown code still reads as words rather than as a raw event key.
assert.equal(
  getAuditEventDescription("some.unknown.event", enMessages.common.auditEvents),
  "Some Unknown Event",
  "an unknown event falls back to its humanised code",
);

// Category options carry the reader's wording, not the raw codes.
const posOrderOptions = getAuditEventTypesByCategory(
  "pos_order",
  zhCNMessages.common.auditEvents,
);
assert.ok(posOrderOptions.length > 0, "pos_order must offer event options");
assert.equal(
  posOrderOptions.every((option) => /[一-龥]/.test(option.label)),
  true,
  "zh-CN event options must be labelled in Chinese",
);

const allOptions = getAuditEventTypesByCategory(
  undefined,
  frMessages.common.auditEvents,
);
assert.equal(
  allOptions.length,
  describedEvents.length,
  "with no category selected every routed event must be offered",
);

console.log("audit event description smoke passed.");
