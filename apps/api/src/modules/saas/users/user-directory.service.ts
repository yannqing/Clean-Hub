import { randomInt } from "node:crypto";
import { getDb, type Database } from "@cleanhub/db";

import { writeAuditLog } from "../../audit/audit.helper.js";
import { assertPasswordMeetsPolicy } from "../../auth/password-policy.helper.js";
import {
  hashPassword,
  hashPin,
  verifyPassword,
} from "../../auth/password.service.js";
import { generateTemporaryPassword } from "../../auth/temporary-password.helper.js";
import { lockTenantPinAssignments } from "../../tenant/users/tenant-users.repository.js";
import { resolveEffectiveSecurityPolicy } from "../security/security-policy.js";
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

async function generateAvailablePin(
  db: Database,
  target: SaasUserDirectoryDetail,
): Promise<string> {
  const candidates = await findDirectoryPinCandidates(db, target);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const pin = randomInt(1_000_000).toString().padStart(6, "0");
    let conflict = false;
    for (const candidate of candidates) {
      if (await verifyPassword(pin, candidate.pinHash)) {
        conflict = true;
        break;
      }
    }
    if (!conflict) return pin;
  }
  throw new SaasUsersError(
    "SAAS_USER_PIN_GENERATION_FAILED",
    "Could not generate an available PIN. Please try again.",
    503,
  );
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
    const value =
      credential === "pin"
        ? await generateAvailablePin(tx, target)
        : generateTemporaryPassword();
    if (credential === "password") {
      assertPasswordMeetsPolicy(
        value,
        await resolveEffectiveSecurityPolicy(tx),
      );
    }
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
