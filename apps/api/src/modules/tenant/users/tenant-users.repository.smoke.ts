import assert from "node:assert/strict";

import "../../../config/env.js";

import {
  auditLogs,
  authRefreshTokens,
  branches,
  closeDbConnection,
  getDb,
  posStaffShifts,
  posTerminalSettings,
  roles,
  tenants,
  userBranches,
  userRoles,
  users,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";
import { and, desc, eq, isNull } from "drizzle-orm";

import { AuthError } from "../../auth/auth.errors.js";
import { AuthRepository } from "../../auth/auth.repository.js";
import { AuthService } from "../../auth/auth.service.js";
import { TokenService } from "../../auth/token.service.js";
import type { AuthContext } from "../../auth/auth.types.js";
import { verifyPassword } from "../../auth/password.service.js";
import { TenantUserError } from "./tenant-users.errors.js";
import {
  findTenantPinCandidates,
  findTenantUserById,
} from "./tenant-users.repository.js";
import {
  createTenantUser,
  deleteTenantUser,
  resetTenantUserPassword,
  resetTenantUserPin,
  updateTenantUserStatus,
} from "./tenant-users.service.js";

const ROLLBACK = new Error("TENANT_USERS_SMOKE_ROLLBACK");

function authContext(input: {
  userId: string;
  tenantId: string;
  role: "owner" | "manager";
  branchIds: string[];
}): AuthContext {
  return {
    userId: input.userId,
    displayName: "Tenant users smoke",
    tenantId: input.tenantId,
    branchIds: input.branchIds,
    role: input.role,
    roles: [input.role],
    permissions: [],
    accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

async function findFreePin(
  db: Parameters<typeof findTenantPinCandidates>[0],
  tenantId: string,
  branchId: string,
  start: number,
): Promise<string> {
  const candidates = await findTenantPinCandidates(db, { tenantId, branchId });
  for (let offset = 0; offset < 100; offset += 1) {
    const pin = String((start + offset) % 1_000_000).padStart(6, "0");
    let conflict = false;
    for (const candidate of candidates) {
      if (await verifyPassword(pin, candidate.pinHash)) {
        conflict = true;
        break;
      }
    }
    if (!conflict) return pin;
  }
  throw new Error("Could not find an unused PIN for tenant-users smoke test.");
}

export async function runTenantUsersRepositorySmoke(): Promise<void> {
  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      const ownerRows = await tx
        .select({ userId: users.id, tenantId: users.tenantId })
        .from(users)
        .innerJoin(userRoles, eq(userRoles.userId, users.id))
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .innerJoin(tenants, eq(tenants.id, users.tenantId))
        .where(
          and(
            eq(users.userType, "tenant"),
            eq(users.status, "active"),
            isNull(users.deletedAt),
            isNull(userRoles.revokedAt),
            eq(roles.scope, "tenant"),
            eq(roles.code, "owner"),
            eq(roles.status, "active"),
            isNull(roles.deletedAt),
            eq(tenants.status, "active"),
            isNull(tenants.deletedAt),
          ),
        )
        .limit(1);
      const owner = ownerRows[0];
      assert.ok(owner?.tenantId, "tenant-users smoke requires an active owner");

      const branchRows = await tx
        .select({ id: branches.id })
        .from(branches)
        .where(
          and(
            eq(branches.tenantId, owner.tenantId),
            eq(branches.status, "active"),
            isNull(branches.deletedAt),
          ),
        )
        .limit(1);
      const branchId = branchRows[0]?.id;
      assert.ok(branchId, "tenant-users smoke requires an active branch");

      const ownerAuth = authContext({
        userId: owner.userId,
        tenantId: owner.tenantId,
        role: "owner",
        branchIds: [],
      });
      const managerPin = await findFreePin(tx, owner.tenantId, branchId, 910000);
      const managerPassword = "SmokePass123!";
      const managerEmail = `tenant-user-smoke-${createId().toLowerCase()}@example.test`;
      const manager = await createTenantUser(
        {
          authContext: ownerAuth,
          data: {
            displayName: "Smoke manager",
            email: managerEmail,
            roleCode: "manager",
            branchId,
            password: managerPassword,
            pin: managerPin,
            language: "en",
          },
        },
        tx,
      );
      assert.equal(manager.role, "manager");
      assert.deepEqual(manager.branchIds, [branchId]);

      const managerRows = await tx
        .select({ passwordHash: users.passwordHash, pinHash: users.pinHash })
        .from(users)
        .where(eq(users.id, manager.id))
        .limit(1);
      assert.equal(
        await verifyPassword(managerPassword, managerRows[0]!.passwordHash),
        true,
      );
      assert.equal(await verifyPassword(managerPin, managerRows[0]!.pinHash), true);

      const branchBinding = await tx
        .select({ branchId: userBranches.branchId })
        .from(userBranches)
        .where(
          and(
            eq(userBranches.userId, manager.id),
            eq(userBranches.tenantId, owner.tenantId),
          ),
        )
        .limit(1);
      assert.equal(branchBinding[0]?.branchId, branchId);

      const managerAuth = authContext({
        userId: manager.id,
        tenantId: owner.tenantId,
        role: "manager",
        branchIds: [branchId],
      });
      const cashierPin = await findFreePin(tx, owner.tenantId, branchId, 920000);
      const cashier = await createTenantUser(
        {
          authContext: managerAuth,
          data: {
            displayName: "Smoke cashier",
            roleCode: "cashier",
            branchId,
            pin: cashierPin,
            language: "en",
          },
        },
        tx,
      );
      assert.equal(cashier.role, "cashier");

      await assert.rejects(
        () =>
          createTenantUser(
            {
              authContext: managerAuth,
              data: {
                displayName: "Forbidden manager",
                email: `forbidden-${createId().toLowerCase()}@example.test`,
                roleCode: "manager",
                branchId,
                password: managerPassword,
                pin: "930000",
                language: "en",
              },
            },
            tx,
          ),
        (error: unknown) =>
          error instanceof TenantUserError &&
          error.code === "TENANT_USER_ROLE_FORBIDDEN",
      );

      await assert.rejects(
        () =>
          deleteTenantUser(
            {
              authContext: ownerAuth,
              userId: owner.userId,
              data: { reason: "smoke owner deletion protection" },
            },
            tx,
          ),
        (error: unknown) =>
          error instanceof TenantUserError &&
          error.code === "TENANT_USER_OWNER_PROTECTED",
      );

      await assert.rejects(
        () =>
          updateTenantUserStatus(
            {
              authContext: ownerAuth,
              userId: owner.userId,
              data: { status: "disabled", reason: "smoke owner protection" },
            },
            tx,
          ),
        (error: unknown) =>
          error instanceof TenantUserError &&
          error.code === "TENANT_USER_OWNER_PROTECTED",
      );

      const replacementPin = await findFreePin(
        tx,
        owner.tenantId,
        branchId,
        940000,
      );
      await resetTenantUserPin(
        {
          authContext: managerAuth,
          userId: cashier.id,
          data: { pin: replacementPin, reason: "smoke PIN reset" },
        },
        tx,
      );
      const cashierRows = await tx
        .select({ pinHash: users.pinHash })
        .from(users)
        .where(eq(users.id, cashier.id))
        .limit(1);
      assert.equal(
        await verifyPassword(replacementPin, cashierRows[0]!.pinHash),
        true,
      );

      const replacementPassword = "Replacement123!";
      await resetTenantUserPassword(
        {
          authContext: ownerAuth,
          userId: manager.id,
          data: { password: replacementPassword, reason: "smoke password reset" },
        },
        tx,
      );
      const passwordRows = await tx
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, manager.id))
        .limit(1);
      assert.equal(
        await verifyPassword(replacementPassword, passwordRows[0]!.passwordHash),
        true,
      );

      const refreshTokenId = createId();
      const terminalId = createId();
      const shiftId = createId();
      await tx.insert(posTerminalSettings).values({
        id: terminalId,
        tenantId: owner.tenantId,
        branchId,
        deviceId: `tenant-user-smoke-${createId()}`,
        status: "active",
        credentialDigest: `tenant-user-smoke-${createId()}`,
        credentialVersion: 1,
        credentialIssuedAt: new Date(),
        createdBy: owner.userId,
        updatedBy: owner.userId,
      });
      await tx.insert(posStaffShifts).values({
        id: shiftId,
        tenantId: owner.tenantId,
        branchId,
        terminalId,
        staffId: cashier.id,
        currency: "XOF",
        status: "open",
        openingFloat: "0",
        createdBy: cashier.id,
        updatedBy: cashier.id,
      });
      const accessTokenSecret =
        "tenant-users-smoke-access-token-secret-2026";
      const existingToken = await new TokenService({
        secret: accessTokenSecret,
      }).issueTokenPair({
        userId: cashier.id,
        tenantId: owner.tenantId,
        role: "cashier",
        roles: ["cashier"],
        permissions: [],
        branchIds: [branchId],
      });
      await tx.insert(authRefreshTokens).values({
        id: refreshTokenId,
        userId: cashier.id,
        tenantId: owner.tenantId,
        tokenHash: `tenant-user-smoke-${createId()}`,
        familyId: createId(),
        expiresAt: new Date(Date.now() + 60_000),
      });

      const disabled = await updateTenantUserStatus(
        {
          authContext: managerAuth,
          userId: cashier.id,
          data: { status: "disabled", reason: "smoke disable" },
        },
        tx,
      );
      assert.equal(disabled.status, "disabled");

      const disabledRefreshTokenRows = await tx
        .select({ revokedAt: authRefreshTokens.revokedAt })
        .from(authRefreshTokens)
        .where(eq(authRefreshTokens.id, refreshTokenId))
        .limit(1);
      assert.ok(
        disabledRefreshTokenRows[0]?.revokedAt,
        "disabling an employee must revoke active refresh tokens",
      );
      const closedShiftRows = await tx
        .select({
          closingFloat: posStaffShifts.closingFloat,
          endedAt: posStaffShifts.endedAt,
          status: posStaffShifts.status,
          updatedBy: posStaffShifts.updatedBy,
        })
        .from(posStaffShifts)
        .where(eq(posStaffShifts.id, shiftId))
        .limit(1);
      assert.equal(closedShiftRows[0]?.status, "closed");
      assert.ok(closedShiftRows[0]?.endedAt);
      assert.equal(closedShiftRows[0]?.closingFloat, null);
      assert.equal(closedShiftRows[0]?.updatedBy, manager.id);
      await assert.rejects(
        () =>
          new AuthService({
            db: tx,
            accessTokenSecret,
            cookieSecure: false,
          }).getAuthContext(existingToken.accessToken),
        (error: unknown) =>
          error instanceof AuthError && error.code === "USER_DISABLED",
        "an access token issued before disablement must stop authorizing requests",
      );

      const disabledPinCandidates = await new AuthRepository(
        tx,
      ).findPosPinLoginCandidates({
        tenantId: owner.tenantId,
        branchId,
      });
      assert.equal(
        disabledPinCandidates.some((candidate) => candidate.id === cashier.id),
        false,
        "disabled employees must not be POS PIN login candidates",
      );

      await deleteTenantUser(
        {
          authContext: managerAuth,
          userId: cashier.id,
          data: { reason: "smoke employee deletion" },
        },
        tx,
      );

      const deletedUserRows = await tx
        .select({
          deletedAt: users.deletedAt,
          email: users.email,
          phone: users.phone,
          status: users.status,
        })
        .from(users)
        .where(eq(users.id, cashier.id))
        .limit(1);
      assert.equal(deletedUserRows[0]?.status, "disabled");
      assert.ok(deletedUserRows[0]?.deletedAt);
      assert.equal(deletedUserRows[0]?.email, null);
      assert.equal(deletedUserRows[0]?.phone, null);
      assert.equal(
        await findTenantUserById(tx, owner.tenantId, cashier.id),
        null,
        "deleted employees must disappear from tenant staff queries",
      );

      const activeDeletedRoleRows = await tx
        .select({ id: userRoles.id })
        .from(userRoles)
        .where(
          and(
            eq(userRoles.tenantId, owner.tenantId),
            eq(userRoles.userId, cashier.id),
            isNull(userRoles.revokedAt),
          ),
        );
      assert.equal(activeDeletedRoleRows.length, 0);

      const deletedBranchRows = await tx
        .select({ branchId: userBranches.branchId })
        .from(userBranches)
        .where(
          and(
            eq(userBranches.tenantId, owner.tenantId),
            eq(userBranches.userId, cashier.id),
          ),
        );
      assert.equal(deletedBranchRows.length, 0);

      const logs = await tx
        .select({ eventType: auditLogs.eventType, payload: auditLogs.metadata })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.tenantId, owner.tenantId),
            eq(auditLogs.entityId, cashier.id),
          ),
        )
        .orderBy(desc(auditLogs.createdAt));
      assert.ok(logs.some((log) => log.eventType === "tenant_user.pin_reset"));
      assert.ok(logs.some((log) => log.eventType === "tenant_user.status_updated"));
      assert.ok(logs.some((log) => log.eventType === "tenant_user.deleted"));
      assert.equal(JSON.stringify(logs).includes(replacementPin), false);

      throw ROLLBACK;
    });
  } catch (error) {
    if (error !== ROLLBACK) throw error;
  } finally {
    await closeDbConnection();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTenantUsersRepositorySmoke()
    .then(() => console.info("tenant-users repository smoke passed"))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
