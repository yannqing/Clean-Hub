import { createId } from "@cleanhub/id";
import { and, count, eq, isNull } from "drizzle-orm";

import {
  roles,
  type Database,
  userProfiles,
  userRoles,
  users,
} from "@cleanhub/db";

import { writeAuditLog } from "../../audit/audit.helper.js";
import { assertPasswordMeetsPolicy } from "../../auth/password-policy.helper.js";
import { hashPassword, hashPin } from "../../auth/password.service.js";
import { resolveEffectiveSecurityPolicy } from "../security/security-policy.js";

export type CreateTenantOwnerUserInput = {
  tenantId: string;
  displayName: string;
  email: string;
  phone?: string;
  password: string;
  pin: string;
  actorUserId: string;
  ipAddress?: string;
  userAgent?: string;
};

export type TenantOwnerUserResult = {
  id: string;
  tenantId: string;
  email: string;
  phone: string | null;
  displayName: string;
  role: "owner";
  status: "active";
};

export class TenantOwnerUserHelperError extends Error {
  constructor(
    public readonly code: "OWNER_ALREADY_EXISTS" | "TENANT_USER_EMAIL_CONFLICT",
    message: string,
    public readonly status: 409,
  ) {
    super(message);
    this.name = "TenantOwnerUserHelperError";
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string | undefined): string | undefined {
  const trimmed = phone?.trim();

  return trimmed ? trimmed : undefined;
}

async function findActiveTenantOwnerRoleId(
  db: Database,
  tenantId: string,
): Promise<string | null> {
  const rows = await db
    .select({ id: roles.id })
    .from(roles)
    .where(
      and(
        eq(roles.tenantId, tenantId),
        eq(roles.scope, "tenant"),
        eq(roles.code, "owner"),
        eq(roles.status, "active"),
        isNull(roles.deletedAt),
      ),
    )
    .limit(1);

  return rows[0]?.id ?? null;
}

async function ensureTenantOwnerRole(
  db: Database,
  tenantId: string,
): Promise<string> {
  const existingRoleId = await findActiveTenantOwnerRoleId(db, tenantId);

  if (existingRoleId) {
    return existingRoleId;
  }

  const roleId = createId();

  await db.insert(roles).values({
    id: roleId,
    tenantId,
    scope: "tenant",
    code: "owner",
    name: "Owner",
    description: "Tenant owner role.",
    status: "active",
    isSystem: true,
  });

  return roleId;
}

async function countActiveOwners(
  db: Database,
  tenantId: string,
): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(
      and(
        eq(users.tenantId, tenantId),
        eq(users.userType, "tenant"),
        eq(users.status, "active"),
        isNull(users.deletedAt),
        eq(userRoles.tenantId, tenantId),
        isNull(userRoles.branchId),
        isNull(userRoles.revokedAt),
        eq(roles.tenantId, tenantId),
        eq(roles.scope, "tenant"),
        eq(roles.code, "owner"),
        eq(roles.status, "active"),
        isNull(roles.deletedAt),
      ),
    );

  return rows[0]?.value ?? 0;
}

async function findTenantUserByNormalizedEmail(
  db: Database,
  tenantId: string,
  normalizedEmail: string,
): Promise<{ id: string } | null> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.tenantId, tenantId),
        eq(users.userType, "tenant"),
        eq(users.normalizedEmail, normalizedEmail),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function createTenantOwnerUser(
  db: Database,
  input: CreateTenantOwnerUserInput,
): Promise<TenantOwnerUserResult> {
  const normalizedEmail = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);

  if ((await countActiveOwners(db, input.tenantId)) > 0) {
    throw new TenantOwnerUserHelperError(
      "OWNER_ALREADY_EXISTS",
      "Tenant already has an active owner.",
      409,
    );
  }

  const existingUser = await findTenantUserByNormalizedEmail(
    db,
    input.tenantId,
    normalizedEmail,
  );

  if (existingUser) {
    throw new TenantOwnerUserHelperError(
      "TENANT_USER_EMAIL_CONFLICT",
      "A tenant user with this email already exists.",
      409,
    );
  }

  const securityPolicy = await resolveEffectiveSecurityPolicy(db);

  assertPasswordMeetsPolicy(input.password, securityPolicy);

  const [passwordHash, pinHash] = await Promise.all([
    hashPassword(input.password),
    hashPin(input.pin),
  ]);
  const roleId = await ensureTenantOwnerRole(db, input.tenantId);
  const userId = createId();

  await db.insert(users).values({
    id: userId,
    tenantId: input.tenantId,
    userType: "tenant",
    email: normalizedEmail,
    normalizedEmail,
    phone,
    passwordHash,
    pinHash,
    status: "active",
  });

  await db.insert(userProfiles).values({
    userId,
    displayName: input.displayName,
  });

  await db.insert(userRoles).values({
    id: createId(),
    userId,
    roleId,
    tenantId: input.tenantId,
    branchId: null,
    assignedBy: input.actorUserId,
  });

  const user: TenantOwnerUserResult = {
    id: userId,
    tenantId: input.tenantId,
    email: normalizedEmail,
    phone: phone ?? null,
    displayName: input.displayName,
    role: "owner",
    status: "active",
  };

  await writeAuditLog(db, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    eventCategory: "tenant_user",
    eventType: "tenant_user.created",
    entityType: "user",
    entityId: userId,
    success: true,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    after: user,
    metadata: {
      source: "saas_initial_owner",
    },
  });

  return user;
}
