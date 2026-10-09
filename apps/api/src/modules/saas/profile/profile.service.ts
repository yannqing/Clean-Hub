import { getDb, type Database } from "@cleanhub/db";

import { writeAuditLog } from "../../audit/audit.helper.js";
import { AuthError } from "../../auth/auth.errors.js";
import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";
import { validatePasswordAgainstPolicy } from "../../auth/password-policy.helper.js";
import { hashPassword, verifyPassword } from "../../auth/password.service.js";
import { requireSaasRole } from "../../auth/permission.helper.js";
import { resolveEffectiveSecurityPolicy } from "../security/security-policy.js";
import {
  findSaasUserCredential,
  revokeSaasSelfRefreshTokens,
  updateSaasSelfPasswordRecord,
} from "../users/saas-users.repository.js";

export class SaasProfileError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: 404 | 409 | 422,
  ) {
    super(message);
    this.name = "SaasProfileError";
  }
}

export async function changeSaasSelfPassword(
  input: {
    authContext: AuthContext;
    requestMeta?: AuthRequestMeta;
    currentPassword: string;
    newPassword: string;
  },
  db: Database = getDb(),
): Promise<{ passwordChanged: true; sessionsRevoked: number }> {
  requireSaasRole(input.authContext, ["super_admin", "support"]);
  if (input.authContext.tenantId !== null) {
    throw new AuthError(
      "FORBIDDEN",
      "Tenant users cannot access SaaS profile.",
    );
  }

  const credential = await findSaasUserCredential(db, input.authContext.userId);
  if (!credential) {
    throw new SaasProfileError(
      "SAAS_PROFILE_NOT_FOUND",
      "Profile was not found.",
      404,
    );
  }
  if (!(await verifyPassword(input.currentPassword, credential.passwordHash))) {
    throw new SaasProfileError(
      "CURRENT_PASSWORD_INCORRECT",
      "Current password is incorrect.",
      422,
    );
  }
  if (input.currentPassword === input.newPassword) {
    throw new SaasProfileError(
      "NEW_PASSWORD_UNCHANGED",
      "New password must differ from the current password.",
      422,
    );
  }

  const policy = await resolveEffectiveSecurityPolicy(db);
  const policyError = validatePasswordAgainstPolicy(input.newPassword, policy);
  if (policyError) {
    throw new SaasProfileError("PASSWORD_POLICY_VIOLATION", policyError, 422);
  }

  const passwordHash = await hashPassword(input.newPassword);
  return db.transaction(async (tx) => {
    const updated = await updateSaasSelfPasswordRecord(tx, {
      userId: input.authContext.userId,
      expectedPasswordHash: credential.passwordHash,
      passwordHash,
    });
    if (!updated) {
      throw new SaasProfileError(
        "SAAS_PROFILE_CONFLICT",
        "The account changed. Try again.",
        409,
      );
    }
    const sessionsRevoked = await revokeSaasSelfRefreshTokens(
      tx,
      input.authContext.userId,
    );
    await writeAuditLog(tx, {
      tenantId: null,
      actorUserId: input.authContext.userId,
      eventCategory: "security",
      eventType: "saas_profile.password_changed",
      entityType: "user",
      entityId: input.authContext.userId,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
      metadata: { sessionsRevoked },
    });
    return { passwordChanged: true as const, sessionsRevoked };
  });
}
