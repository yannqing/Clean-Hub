import assert from "node:assert/strict";
import "../../../config/env.js";
import { eq } from "drizzle-orm";
import {
  branches,
  closeDbConnection,
  getDb,
  posCashDrawerSessions,
  posChannelSettings,
  posRegisterSessions,
  posStaffShifts,
  posTerminalSettings,
  runWithSystemDatabaseContext,
  tenantSettings,
  tenants,
  users,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";
import type { AuthContext } from "../../auth/auth.types.js";
import { ensurePaymentRegisterContext } from "./staff.service.js";
import {
  insertCashDrawerSession,
  findOpenRegisterSession,
} from "./staff.repository.js";

const rollback = new Error("OPTIONAL_CHECKOUT_TEST_ROLLBACK");
async function run() {
  assert.ok(
    ["localhost", "127.0.0.1", "postgres", "[::1]"].includes(
      new URL(process.env.DATABASE_URL!).hostname,
    ),
    "Use a local test database.",
  );
  try {
    await runWithSystemDatabaseContext(async () => {
      try {
        await getDb().transaction(async (tx) => {
          const tenantId = createId(),
            userId = createId(),
            otherUserId = createId(),
            branchId = createId(),
            terminalId = createId();
          await tx
            .insert(tenants)
            .values({
              id: tenantId,
              name: "Optional POS checkout test",
              pressingCode: `OPTIONAL-${tenantId}`,
              status: "active",
            });
          await tx
            .insert(users)
            .values(
              [userId, otherUserId].map((id) => ({
                id,
                tenantId,
                userType: "tenant" as const,
                passwordHash: "test",
                pinHash: "test",
                status: "active" as const,
              })),
            );
          await tx
            .insert(tenantSettings)
            .values({ id: createId(), tenantId, defaultCurrency: "XOF" });
          await tx
            .insert(branches)
            .values({
              id: branchId,
              tenantId,
              name: "Checkout store",
              defaultCurrency: "XOF",
              status: "active",
              cashHandlingMode: "shared_drawer",
            });
          await tx
            .insert(posTerminalSettings)
            .values({
              id: terminalId,
              tenantId,
              branchId,
              deviceId: terminalId,
              status: "active",
              credentialDigest: "test",
              credentialVersion: 1,
            });
          const auth: AuthContext = {
            tenantId,
            userId,
            displayName: "Cashier",
            role: "cashier",
            roles: ["cashier"],
            permissions: [],
            branchIds: [branchId],
            terminalId,
            terminalBranchId: branchId,
            terminalDeviceId: terminalId,
            terminalCredentialVersion: 1,
            accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
          };

          // Tenants without a settings row use the same simplified defaults.
          const first = await ensurePaymentRegisterContext(auth, "cash", tx);
          assert.ok(first.registerSessionId);
          assert.equal(first.shiftId, null);
          assert.equal(first.cashDrawerSessionId, null);
          await tx
            .insert(posChannelSettings)
            .values({ id: createId(), tenantId });
          const [defaults] = await tx
            .select()
            .from(posChannelSettings)
            .where(eq(posChannelSettings.tenantId, tenantId));
          assert.equal(defaults!.cashTrackingEnabled, false);
          assert.equal(defaults!.requireOpeningFloat, false);
          assert.equal(defaults!.requireClosingCount, false);
          assert.deepEqual(
            await ensurePaymentRegisterContext(auth, "cash", tx),
            first,
          );
          assert.equal(
            (
              await tx
                .select()
                .from(posStaffShifts)
                .where(eq(posStaffShifts.tenantId, tenantId))
            ).length,
            0,
            "checkout must not clock in the employee implicitly",
          );
          assert.equal(
            (
              await tx
                .select()
                .from(posCashDrawerSessions)
                .where(eq(posCashDrawerSessions.tenantId, tenantId))
            ).length,
            0,
            "default checkout must not open a cash drawer",
          );
          assert.equal(
            (
              await tx
                .select()
                .from(posRegisterSessions)
                .where(eq(posRegisterSessions.tenantId, tenantId))
            ).length,
            1,
          );

          const legacy = await insertCashDrawerSession(tx, {
            tenantId,
            branchId,
            terminalId,
            registerSessionId: first.registerSessionId,
            handlingMode: "shared_drawer",
            assignedStaffId: null,
            currency: "XOF",
            openingFloat: "100",
            actorUserId: userId,
          });
          assert.ok(legacy);
          const replay = await ensurePaymentRegisterContext(auth, "cash", tx, {
            registerSessionId: first.registerSessionId,
            cashDrawerSessionId: legacy.id,
          });
          assert.equal(
            replay.cashDrawerSessionId,
            legacy.id,
            "queued payments keep their old drawer link after cash tracking is disabled",
          );
          assert.equal(
            (await ensurePaymentRegisterContext(auth, "cash", tx))
              .cashDrawerSessionId,
            null,
            "new payments must not inherit the legacy drawer",
          );
          await tx
            .update(posCashDrawerSessions)
            .set({ handlingMode: "cash_in_hand", assignedStaffId: otherUserId })
            .where(eq(posCashDrawerSessions.id, legacy.id));
          await assert.rejects(
            ensurePaymentRegisterContext(auth, "cash", tx, {
              registerSessionId: first.registerSessionId,
              cashDrawerSessionId: legacy.id,
            }),
            { code: "CASH_SESSION_REQUIRED" },
          );
          await tx
            .update(posCashDrawerSessions)
            .set({ status: "closed", closedAt: new Date() })
            .where(eq(posCashDrawerSessions.id, legacy.id));
          await assert.rejects(
            ensurePaymentRegisterContext(auth, "cash", tx, {
              registerSessionId: first.registerSessionId,
              cashDrawerSessionId: legacy.id,
            }),
            { code: "CASH_SESSION_REQUIRED" },
          );

          // Explicitly opting into cash tracking continues to respect its rules.
          await tx
            .update(posChannelSettings)
            .set({ cashTrackingEnabled: true, requireOpeningFloat: true })
            .where(eq(posChannelSettings.tenantId, tenantId));
          await assert.rejects(ensurePaymentRegisterContext(auth, "cash", tx), {
            code: "CASH_SESSION_REQUIRED",
          });
          await tx
            .update(posChannelSettings)
            .set({ requireOpeningFloat: false })
            .where(eq(posChannelSettings.tenantId, tenantId));
          const optional = await ensurePaymentRegisterContext(auth, "cash", tx);
          assert.ok(optional.cashDrawerSessionId);
          assert.equal(optional.shiftId, null);
          assert.ok(
            await findOpenRegisterSession(tx, { tenantId, terminalId }),
          );
          throw rollback;
        });
      } catch (error) {
        if (error !== rollback) throw error;
      }
    });
    console.log(
      "Optional POS checkout integration passed: no shift/drawer prerequisites, automatic register, legacy replay ownership and opt-in cash tracking.",
    );
  } finally {
    await closeDbConnection();
  }
}
await run();
