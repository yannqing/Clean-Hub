import { getDb, type Database } from "@cleanhub/db";
import { RESET_USER_PASSWORD, RESET_USER_PIN } from "@cleanhub/domain/initial-owner-credentials";

import { writeAuditLog } from "../../audit/audit.helper.js";
import {
  hashPassword,
  hashPin,
  verifyPassword,
} from "../../auth/password.service.js";
import { lockTenantPinAssignments } from "../../tenant/users/tenant-users.repository.js";
import { requireSaasUsersAccess } from "./saas-users-access.js";
import { SaasUsersError } from "./saas-users.errors.js";
import {
  findDirectoryPinCandidates,
  findSaasUserDirectoryDetailById,
  lockDirectoryUserCredentials,
  resetDirectoryUserCredentialRecord,
} from "./saas-users.repository.js";
import type {
  GetSaasUserDetailInput,
  ResetSaasUserPasswordInput,
  ResetSaasUserPasswordResult,
  ResetDirectoryUserPinResult,
  SaasUserDirectoryDetail,
} from "./saas-users.types.js";

async function requireDirectoryTarget(
  db: Database,
  userId: string,
): Promise<SaasUserDirectoryDetail> {
  const target = await findSaasUserDirectoryDetailById(db, userId);
  if (!target)
    throw new SaasUsersError(
      "SAAS_USER_NOT_FOUND",
      "User was not found in the platform directory.",
      404,
    );
  return target;
}

export async function getSaasUserDirectoryDetail(
  input: GetSaasUserDetailInput,
  db: Database = getDb(),
): Promise<SaasUserDirectoryDetail> {
  requireSaasUsersAccess(input.authContext, ["super_admin", "support"]);
  return requireDirectoryTarget(db, input.userId);
}

async function assertResetPinAvailable(
  db: Database,
  target: SaasUserDirectoryDetail,
): Promise<void> {
  if (!target.tenantId) return;
  const candidates = await findDirectoryPinCandidates(db, target);
  for (const candidate of candidates) {
    if (await verifyPassword(RESET_USER_PIN, candidate.pinHash)) {
      throw new SaasUsersError(
        "SAAS_USER_PIN_CONFLICT",
        `The default PIN ${RESET_USER_PIN} is already used by another user in this tenant. Change that user's PIN before resetting this user.`,
        409,
      );
    }
  }
}

async function resetDirectoryCredential(
  input: ResetSaasUserPasswordInput,
  credential: "password" | "pin",
  db: Database,
): Promise<string> {
  requireSaasUsersAccess(input.authContext, ["super_admin"]);
  if (input.userId === input.authContext.userId) {
    throw new SaasUsersError(
      "SAAS_USER_CANNOT_RESET_OWN_CREDENTIALS",
      "Use your profile settings to change your own credentials.",
      422,
    );
  }
  const reason = input.reason.trim();
  if (!reason || reason.length > 500) {
    throw new SaasUsersError(
      "SAAS_USER_RESET_REASON_INVALID",
      "A reason between 1 and 500 characters is required.",
      422,
    );
  }

  return db.transaction(async (tx) => {
    const initialTarget = await requireDirectoryTarget(tx, input.userId);
    // Share the tenant-wide assignment lock with the tenant and POS staff flows.
    // Take it before the user row lock to preserve their lock ordering.
    if (credential === "pin" && initialTarget.tenantId) {
      await lockTenantPinAssignments(tx, initialTarget.tenantId);
    }
    await lockDirectoryUserCredentials(tx, initialTarget);
    const target = await requireDirectoryTarget(tx, input.userId);
    const value = credential === "pin" ? RESET_USER_PIN : RESET_USER_PASSWORD;
    if (credential === "pin") await assertResetPinAvailable(tx, target);
    // Administrator recovery uses the agreed defaults. Password policy still
    // applies when a user chooses a password in the normal profile flow.
    const hash =
      credential === "pin" ? await hashPin(value) : await hashPassword(value);
    if (
      !(await resetDirectoryUserCredentialRecord(tx, {
        target,
        credential,
        hash,
      }))
    ) {
      throw new SaasUsersError(
        "SAAS_USER_NOT_FOUND",
        "User was not found in the platform directory.",
        404,
      );
    }
    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId: target.tenantId,
      eventCategory:
        target.accountType === "tenant" ? "tenant_user" : "saas_user",
      eventType: `${target.accountType === "tenant" ? "tenant_user" : "saas_user"}.${credential}_reset`,
      entityType: "user",
      entityId: target.id,
      reason,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
      metadata: {
        accountType: target.accountType,
        initiatedFrom: "platform_user_directory",
      },
    });
    return value;
  });
}

export async function resetDirectoryUserPassword(
  input: ResetSaasUserPasswordInput,
  db: Database = getDb(),
): Promise<ResetSaasUserPasswordResult> {
  return {
    temporaryPassword: await resetDirectoryCredential(input, "password", db),
  };
}

export async function resetDirectoryUserPin(
  input: ResetSaasUserPasswordInput,
  db: Database = getDb(),
): Promise<ResetDirectoryUserPinResult> {
  return { temporaryPin: await resetDirectoryCredential(input, "pin", db) };
}
