import assert from "node:assert/strict";

import {
  AUDIT_EVENT_DICTIONARY,
  UNDESCRIBED_AUDIT_EVENT_TYPES,
  getAuditEventDescription,
  getAuditEventTypesByCategory,
} from "./event-description";

const LOCALES = ["zh-CN", "fr"] as const;

const englishEventTypes = Object.values(AUDIT_EVENT_DICTIONARY).flatMap(
  (group) => Object.keys(group),
);

assert.ok(
  englishEventTypes.length > 0,
  "the dictionary must describe at least one event",
);

// Every described event must be described in every language. This is the only
// thing stopping a translation gap from reopening: the maps are plain objects,
// so nothing else notices when one language is forgotten -- which is how French
// came to be missing entirely.
for (const eventType of englishEventTypes) {
  const english = getAuditEventDescription(eventType);
  assert.notEqual(
    english,
    "",
    `${eventType} must have an English description`,
  );

  for (const locale of LOCALES) {
    const translated = getAuditEventDescription(eventType, locale);
    assert.notEqual(
      translated,
      english,
      `${eventType} is missing a ${locale} description (it fell back to English)`,
    );
  }
}

// The deliberately undescribed events must stay undescribed rather than pick up
// a confident guess. They are listed so the gap is visible, not forgotten.
for (const eventType of UNDESCRIBED_AUDIT_EVENT_TYPES) {
  assert.equal(
    englishEventTypes.includes(eventType),
    false,
    `${eventType} is listed as undescribed but has a description; remove it from the list`,
  );
}

// An unknown code must still read as words rather than as a raw event key.
assert.equal(
  getAuditEventDescription("some.unknown.event", "zh-CN"),
  "Some Unknown Event",
  "an undescribed event falls back to its humanised code",
);

// Category options must carry the locale through to their labels.
const posOrderOptions = getAuditEventTypesByCategory("pos_order", "zh-CN");
assert.ok(
  posOrderOptions.length > 0,
  "pos_order must offer event type options",
);
assert.equal(
  posOrderOptions.every((option) => /[一-龥]/.test(option.label)),
  true,
  "zh-CN event type options must be labelled in Chinese",
);

const allOptions = getAuditEventTypesByCategory(undefined, "fr");
assert.equal(
  allOptions.length,
  englishEventTypes.length,
  "with no category selected every described event must be offered",
);

console.log("audit event description smoke passed.");
