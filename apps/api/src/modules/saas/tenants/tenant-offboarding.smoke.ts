import assert from "node:assert/strict";

import "../../../config/env.js";

import { and, eq, isNull } from "drizzle-orm";

import { closeDbConnection, getDb, tenants, users } from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import {
  listTenantScopedTables,
  buildTenantExportArchive,
} from "./tenant-export.service.js";
import {
  offboardSaasTenantRecord,
  purgeElapsedTenants,
  restoreSaasTenantRecord,
} from "./tenants.repository.js";

const ROLLBACK = new Error("TENANT_OFFBOARDING_SMOKE_ROLLBACK");

/**
 * Credential and replay-protection tables. An export hands the tenant their
 * business records; leaking these would hand over secrets instead.
 */
const MUST_NEVER_EXPORT = [
  "auth_refresh_tokens",
  "customer_auth_otps",
  "customer_auth_refresh_tokens",
  "customer_credentials",
  "mobile_push_tokens",
  "order_discount_idempotency_receipts",
] as const;

const RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function runTenantOffboardingSmoke(): Promise<void> {
  const db = getDb();

  try {
    await db.transaction(async (tx) => {
      const tenantId = createId();
      const actorUserId = createId();

      await tx.insert(tenants).values({
        id: tenantId,
        name: "Tenant offboarding smoke",
        pressingCode: `OFF-${createId()}`,
        status: "active",
      });
      await tx.insert(users).values({
        id: actorUserId,
        tenantId,
        userType: "tenant",
        passwordHash: "not-used-by-smoke",
        pinHash: "not-used-by-smoke",
        status: "active",
      });

      // --- The export must never carry credential tables ------------------
      const exportable = await listTenantScopedTables(tx);
      for (const excluded of MUST_NEVER_EXPORT) {
        assert.equal(
          exportable.includes(excluded),
          false,
          `${excluded} must never be exported`,
        );
      }
      assert.ok(
        exportable.length > 0,
        "table discovery should find tenant-scoped tables",
      );

      const archive = await buildTenantExportArchive(tenantId, tx);
      const magic = Buffer.from(archive.content).subarray(0, 4).toString("hex");
      assert.equal(magic, "504b0304", "export should be a real zip archive");

      // --- Offboarding opens a retention window ---------------------------
      const offboarded = await offboardSaasTenantRecord(tx, {
        tenantId,
        actorUserId,
        reason: "Smoke: tenant left",
        retentionDays: RETENTION_DAYS,
      });

      assert.ok(offboarded, "offboarding should return the tenant");
      assert.equal(offboarded.status, "disabled");
      assert.ok(offboarded.offboarding, "offboarding state should be set");
      assert.equal(offboarded.offboarding.offboardReason, "Smoke: tenant left");

      const purgeAfter = new Date(offboarded.offboarding.purgeAfter).getTime();
      const expected = Date.now() + RETENTION_DAYS * DAY_MS;
      // Allow a minute of slack for clock/round-trip, but the window must be
      // ~90 days out rather than immediate.
      assert.ok(
        Math.abs(purgeAfter - expected) < 60_000,
        `purgeAfter should be ~${RETENTION_DAYS} days out, got ${offboarded.offboarding.purgeAfter}`,
      );

      // --- A tenant inside its window is NOT purged -----------------------
      const purgedEarly = await purgeElapsedTenants({ limit: 100 }, tx);
      assert.equal(
        purgedEarly.includes(tenantId),
        false,
        "a tenant inside its retention window must not be purged",
      );

      const stillLive = await tx
        .select({ deletedAt: tenants.deletedAt })
        .from(tenants)
        .where(eq(tenants.id, tenantId));
      assert.equal(stillLive[0]?.deletedAt, null);

      // --- Restore clears the whole offboarding record --------------------
      const restored = await restoreSaasTenantRecord(tx, {
        tenantId,
        actorUserId,
      });
      assert.ok(restored, "restore should return the tenant");
      assert.equal(
        restored.offboarding,
        null,
        "restore must clear the offboarding state",
      );
      // Deliberately `suspended`, not `active`: resuming service is a separate
      // decision from undoing the offboarding.
      assert.equal(restored.status, "suspended");

      // --- Once the window has elapsed, the purge takes it ----------------
      await offboardSaasTenantRecord(tx, {
        tenantId,
        actorUserId,
        reason: "Smoke: window elapsed",
        retentionDays: RETENTION_DAYS,
      });
      // Backdate the window rather than waiting 90 days.
      await tx
        .update(tenants)
        .set({ purgeAfter: new Date(Date.now() - DAY_MS) })
        .where(eq(tenants.id, tenantId));

      const purgedLate = await purgeElapsedTenants({ limit: 100 }, tx);
      assert.ok(
        purgedLate.includes(tenantId),
        "a tenant past its retention window should be purged",
      );

      const afterPurge = await tx
        .select({ id: tenants.id })
        .from(tenants)
        .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)));
      assert.equal(
        afterPurge.length,
        0,
        "purge should soft-delete the tenant row",
      );

      throw ROLLBACK;
    });
  } catch (error) {
    if (error !== ROLLBACK) throw error;
  } finally {
    await closeDbConnection();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTenantOffboardingSmoke()
    .then(() => console.info("saas tenant offboarding smoke passed"))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
