import { getDb, type Database } from "@cleanhub/db";

import { hashPassword } from "../auth/password.service.js";
import { requireSaasRole } from "../auth/permission.helper.js";
import { SaasUsersError } from "./saas-users.errors.js";
import {
  createSaasUserRecord,
  findActiveSaasRoleByCode,
  findSaasUserByNormalizedEmail,
  findSaasUserByPhone,
  findSaasUsers,
  writeSaasUserCreatedAuditLog,
} from "./saas-users.repository.js";
import type {
  CreateSaasUserInput,
  ListSaasUsersInput,
  SaasUserListItem,
} from "./saas-users.types.js";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string | undefined): string | undefined {
  const trimmed = phone?.trim();

  return trimmed ? trimmed : undefined;
}

export async function listSaasUsers(
  input: ListSaasUsersInput,
  db: Database = getDb(),
): Promise<SaasUserListItem[]> {
  requireSaasRole(input.authContext, ["super_admin", "support"]);

  return findSaasUsers(db, input.query);
}

export async function createSaasUser(
  input: CreateSaasUserInput,
  db: Database = getDb(),
): Promise<SaasUserListItem> {
  requireSaasRole(input.authContext, ["super_admin"]);

  const normalizedEmail = normalizeEmail(input.data.email);
  const phone = normalizePhone(input.data.phone);
  const passwordHash = await hashPassword(input.data.password);

  return db.transaction(async (tx) => {
    const existingUser = await findSaasUserByNormalizedEmail(
      tx,
      normalizedEmail,
    );

    if (existingUser) {
      throw new SaasUsersError(
        "SAAS_USER_EMAIL_CONFLICT",
        "A SaaS user with this email already exists.",
        409,
      );
    }

    if (phone) {
      const existingPhoneUser = await findSaasUserByPhone(tx, phone);

      if (existingPhoneUser) {
        throw new SaasUsersError(
          "SAAS_USER_PHONE_CONFLICT",
          "A SaaS user with this phone already exists.",
          409,
        );
      }
    }

    const role = await findActiveSaasRoleByCode(tx, input.data.roleCode);

    if (!role) {
      throw new SaasUsersError(
        "SAAS_USER_ROLE_INVALID",
        "SaaS role is invalid or disabled.",
        422,
      );
    }

    const user = await createSaasUserRecord(tx, {
      actorUserId: input.authContext.userId,
      email: normalizedEmail,
      phone,
      normalizedEmail,
      displayName: input.data.displayName,
      passwordHash,
      role,
      language: input.data.language,
    });

    await writeSaasUserCreatedAuditLog(tx, {
      actorUserId: input.authContext.userId,
      user,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return user;
  });
}
