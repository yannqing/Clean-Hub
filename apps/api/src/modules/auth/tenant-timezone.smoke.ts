import assert from "node:assert/strict";

import {
  dateTimeLocalToUtc,
  getUtcDayRangeInTimeZone,
  toDateTimeLocalValue,
} from "@cleanhub/domain/timezone";

import { updateTenantSettingsBodySchema } from "../tenant/settings/settings.validation.js";

const shanghaiDay = getUtcDayRangeInTimeZone(
  "2026-08-06",
  "Asia/Shanghai",
);
assert.equal(shanghaiDay.from.toISOString(), "2026-08-05T16:00:00.000Z");
assert.equal(shanghaiDay.to.toISOString(), "2026-08-06T16:00:00.000Z");

const newYorkDstDay = getUtcDayRangeInTimeZone(
  "2026-03-08",
  "America/New_York",
);
assert.equal(
  newYorkDstDay.to.getTime() - newYorkDstDay.from.getTime(),
  23 * 60 * 60 * 1000,
);

const localValue = "2026-08-06T09:30";
const instant = dateTimeLocalToUtc(localValue, "Asia/Shanghai");
assert.equal(instant?.toISOString(), "2026-08-06T01:30:00.000Z");
assert.equal(
  instant ? toDateTimeLocalValue(instant, "Asia/Shanghai") : null,
  localValue,
);

assert.equal(
  updateTenantSettingsBodySchema.safeParse({
    timezone: "Asia/Shanghai",
  }).success,
  true,
);
assert.equal(
  updateTenantSettingsBodySchema.safeParse({ timezone: "Mars/Olympus" })
    .success,
  false,
);
assert.equal(
  updateTenantSettingsBodySchema.safeParse({
    tenantName: "CleanHub Dakar",
    contactEmail: "owner@example.com",
    tenantVersion: 2,
  }).success,
  true,
);
assert.equal(
  updateTenantSettingsBodySchema.safeParse({
    tenantName: "CleanHub Dakar",
  }).success,
  false,
);
assert.equal(
  updateTenantSettingsBodySchema.safeParse({ tenantVersion: 2 }).success,
  false,
);
assert.equal(
  updateTenantSettingsBodySchema.safeParse({
    contactEmail: "not-an-email",
    tenantVersion: 2,
  }).success,
  false,
);
assert.equal(
  updateTenantSettingsBodySchema.parse({
    contactPhone: "   ",
    tenantVersion: 2,
  }).contactPhone,
  null,
);

console.log("tenant timezone and settings validation smoke checks passed");
