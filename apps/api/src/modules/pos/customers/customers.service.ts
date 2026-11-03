import { getDb, type Database } from "@cleanhub/db";

import type { AuthContext } from "../../auth/auth.types.js";
import {
  authorizePosSensitiveOperation,
  createPosAuditMetadata,
  requireAnyPosBranchAccess,
  requirePosTenantId,
  resolvePosBranchScope,
} from "../access-control.helper.js";
import { PosCustomerError } from "./customers.errors.js";
import {
  cascadeSoftDeleteProfilesByAccount,
  countPosAccounts,
  countPosProfiles,
  findPosCustomerOrderStats,
  findPosCustomerServiceItems,
  findPosAccountByEmail,
  findPosAccountById,
  findPosAccountByPhone,
  findPosAccountAuditSnapshot,
  findPosProfileAuditSnapshot,
  findPosProfileById,
  findPosProfilesByAccount,
  insertPosAccount,
  insertPosProfile,
  searchPosAccounts,
  searchPosProfiles,
  setPosAccountStatus,
  setPosProfileStatus,
  softDeletePosAccount,
  softDeletePosProfile,
  updatePosAccountRecord,
  updatePosProfileRecord,
  writePosAccountAuditLog,
  writePosProfileAuditLog,
} from "./customers.repository.js";
import type {
  ChangePosAccountStatusInput,
  ChangePosProfileStatusInput,
  CreatePosAccountInput,
  CreatePosProfileInput,
  DeletePosAccountInput,
  DeletePosProfileInput,
  GetPosCustomerOrderStatsInput,
  GetPosAccountInput,
  GetPosProfileInput,
  GetPosProfilesByAccountInput,
  ListPosAccountProfilesResult,
  ListPosCustomerServiceItemsInput,
  ListPosCustomerServiceItemsResult,
  ListPosCustomersInput,
  ListPosCustomersResult,
  PosCustomerAccountDetail,
  PosCustomerOrderStats,
  PosCustomerAccountSummary,
  PosCustomerProfileDetail,
  PosCustomerProfileWithAccount,
  UpdatePosAccountInput,
  UpdatePosProfileInput,
} from "./customers.types.js";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function requireAccount(
  account: PosCustomerAccountDetail | null,
): PosCustomerAccountDetail {
  if (!account) {
    throw new PosCustomerError(
      "POS_ACCOUNT_NOT_FOUND",
      "Customer account was not found.",
      404,
    );
  }
  return account;
}

function requireProfile(
  profile: PosCustomerProfileDetail | null,
): PosCustomerProfileDetail {
  if (!profile) {
    throw new PosCustomerError(
      "POS_CUSTOMER_NOT_FOUND",
      "Customer profile was not found.",
      404,
    );
  }
  return profile;
}

function customerAuditContext(authContext: AuthContext): {
  branchId?: string;
  metadata: Record<string, unknown>;
} {
  return {
    branchId: authContext.terminalBranchId,
    metadata: createPosAuditMetadata(authContext),
  };
}

// ---- list -----------------------------------------------------------------

export async function listPosCustomers(
  input: ListPosCustomersInput,
  db: Database = getDb(),
): Promise<ListPosCustomersResult> {
  const tenantId = requirePosTenantId(input.authContext);

  const { query } = input;
  const allowedBranchIds = resolvePosBranchScope(input.authContext);

  if (allowedBranchIds?.length === 0) {
    return {
      data: [],
      total: 0,
      totalAccounts: 0,
      totalProfiles: 0,
      limit: query.limit,
      offset: query.offset,
    };
  }

  if (query.resultType === "account") {
    const [{ items, total }, totalProfiles] = await Promise.all([
      searchPosAccounts(db, tenantId, query),
      countPosProfiles(db, tenantId, query),
    ]);
    return {
      data: items.map((account) => ({ kind: "account" as const, account })),
      total,
      totalAccounts: total,
      totalProfiles,
      limit: query.limit,
      offset: query.offset,
    };
  }

  if (query.resultType === "profile") {
    const [{ items, total }, totalAccounts] = await Promise.all([
      searchPosProfiles(db, tenantId, query),
      countPosAccounts(db, tenantId, query),
    ]);
    return {
      data: items.map((profile) => ({ kind: "profile" as const, profile })),
      total,
      totalAccounts,
      totalProfiles: total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  // No result-type filter: merge accounts and profiles, then re-apply
  // limit/offset over the combined set ordered by createdAt desc. Counts are
  // still computed independently so total reflects both tables.
  const [accountsResult, profilesResult] = await Promise.all([
    searchPosAccounts(db, tenantId, { ...query, limit: query.offset + query.limit, offset: 0 }),
    searchPosProfiles(db, tenantId, { ...query, limit: query.offset + query.limit, offset: 0 }),
  ]);

  type AccountEntry = { kind: "account"; account: PosCustomerAccountSummary; createdAt: string };
  type ProfileEntry = {
    kind: "profile";
    profile: PosCustomerProfileWithAccount;
    createdAt: string;
  };

  const merged: Array<AccountEntry | ProfileEntry> = [
    ...accountsResult.items.map<AccountEntry>((account) => ({
      kind: "account",
      account,
      createdAt: account.createdAt,
    })),
    ...profilesResult.items.map<ProfileEntry>((profile) => ({
      kind: "profile",
      profile,
      createdAt: profile.createdAt,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const total = accountsResult.total + profilesResult.total;
  const page = merged.slice(query.offset, query.offset + query.limit);

  return {
    data: page.map((entry) =>
      entry.kind === "account"
        ? { kind: "account", account: entry.account }
        : { kind: "profile", profile: entry.profile },
    ),
    total,
    totalAccounts: accountsResult.total,
    totalProfiles: profilesResult.total,
    limit: query.limit,
    offset: query.offset,
  };
}

// ---- accounts: reads ------------------------------------------------------

export async function getPosAccount(
  input: GetPosAccountInput,
  db: Database = getDb(),
): Promise<PosCustomerAccountDetail> {
  requireAnyPosBranchAccess(input.authContext);
  const account = await findPosAccountById(
    db,
    input.authContext.tenantId!,
    input.accountId,
  );
  return requireAccount(account);
}

export async function getPosProfilesByAccount(
  input: GetPosProfilesByAccountInput,
  db: Database = getDb(),
): Promise<ListPosAccountProfilesResult> {
  requireAnyPosBranchAccess(input.authContext);
  const tenantId = requirePosTenantId(input.authContext);

  // Verify the account exists (and is not soft-deleted) before listing its
  // profiles, so callers get a clean 404 instead of an empty list.
  const account = await findPosAccountById(db, tenantId, input.accountId);
  requireAccount(account);

  return findPosProfilesByAccount(
    db,
    tenantId,
    input.accountId,
    input.query,
  );
}

// ---- accounts: writes -----------------------------------------------------

export async function createPosAccount(
  input: CreatePosAccountInput,
  db: Database = getDb(),
): Promise<PosCustomerAccountDetail> {
  requireAnyPosBranchAccess(input.authContext);
  const tenantId = requirePosTenantId(input.authContext);

  if (input.data.id) {
    const existing = await findPosAccountById(db, tenantId, input.data.id);
    if (existing) {
      return existing;
    }
  }

  if (!input.data.phone && !input.data.email) {
    throw new PosCustomerError(
      "POS_PHONE_OR_EMAIL_REQUIRED",
      "At least one of phone or email is required.",
      400,
    );
  }

  if (input.data.phone) {
    const existing = await findPosAccountByPhone(db, tenantId, input.data.phone);
    if (existing) {
      throw new PosCustomerError(
        "POS_PHONE_CONFLICT",
        "A customer account with this phone already exists.",
        409,
      );
    }
  }

  if (input.data.email) {
    const normalizedEmail = normalizeEmail(input.data.email);
    const existing = await findPosAccountByEmail(db, tenantId, normalizedEmail);
    if (existing) {
      throw new PosCustomerError(
        "POS_EMAIL_CONFLICT",
        "A customer account with this email already exists.",
        409,
      );
    }
  }

  const account = await insertPosAccount(db, {
    id: input.data.id,
    actorUserId: input.authContext.userId,
    tenantId,
    accountName: input.data.accountName,
    phone: input.data.phone,
    email: input.data.email,
  });

  await writePosAccountAuditLog(db, {
    ...customerAuditContext(input.authContext),
    actorUserId: input.authContext.userId,
    tenantId,
    accountId: account.id,
    eventType: "pos_customer.account_created",
    after: {
      accountName: account.accountName,
      phone: account.phone,
      email: account.email,
      status: account.status,
    },
    ipAddress: input.requestMeta?.ipAddress,
    userAgent: input.requestMeta?.userAgent,
  });

  return account;
}

export async function updatePosAccount(
  input: UpdatePosAccountInput,
  db: Database = getDb(),
): Promise<PosCustomerAccountDetail> {
  requireAnyPosBranchAccess(input.authContext);
  const tenantId = requirePosTenantId(input.authContext);

  // Ensure the account exists (404) before running conflict checks.
  requireAccount(await findPosAccountById(db, tenantId, input.accountId));

  if (input.data.phone !== undefined && input.data.phone !== null) {
    const conflict = await findPosAccountByPhone(db, tenantId, input.data.phone);
    if (conflict && conflict.id !== input.accountId) {
      throw new PosCustomerError(
        "POS_PHONE_CONFLICT",
        "A customer account with this phone already exists.",
        409,
      );
    }
  }

  if (input.data.email !== undefined && input.data.email !== null) {
    const normalizedEmail = normalizeEmail(input.data.email);
    const conflict = await findPosAccountByEmail(db, tenantId, normalizedEmail);
    if (conflict && conflict.id !== input.accountId) {
      throw new PosCustomerError(
        "POS_EMAIL_CONFLICT",
        "A customer account with this email already exists.",
        409,
      );
    }
  }

  const before = await findPosAccountAuditSnapshot(db, tenantId, input.accountId);

  await updatePosAccountRecord(db, {
    tenantId,
    accountId: input.accountId,
    actorUserId: input.authContext.userId,
    accountName: input.data.accountName,
    phone: input.data.phone,
    email: input.data.email,
  });

  const updated = requireAccount(
    await findPosAccountById(db, tenantId, input.accountId),
  );

  const after = await findPosAccountAuditSnapshot(db, tenantId, input.accountId);

  if (before && after) {
    await writePosAccountAuditLog(db, {
      ...customerAuditContext(input.authContext),
      actorUserId: input.authContext.userId,
      tenantId,
      accountId: input.accountId,
      eventType: "pos_customer.account_updated",
      before,
      after,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
  }

  return updated;
}

export async function changePosAccountStatus(
  input: ChangePosAccountStatusInput,
  db: Database = getDb(),
): Promise<PosCustomerAccountDetail> {
  requireAnyPosBranchAccess(input.authContext);
  const tenantId = requirePosTenantId(input.authContext);

  const existing = requireAccount(
    await findPosAccountById(db, tenantId, input.accountId),
  );

  if (existing.status === input.data.status) {
    throw new PosCustomerError(
      input.data.status === "disabled"
        ? "POS_CUSTOMER_ALREADY_DISABLED"
        : "POS_CUSTOMER_NOT_DISABLED",
      input.data.status === "disabled"
        ? "Customer account is already disabled."
        : "Customer account is not disabled.",
      409,
    );
  }

  const beforeStatus = existing.status;
  await setPosAccountStatus(
    db,
    tenantId,
    input.accountId,
    input.authContext.userId,
    input.data.status,
  );

  await writePosAccountAuditLog(db, {
    ...customerAuditContext(input.authContext),
    actorUserId: input.authContext.userId,
    tenantId,
    accountId: input.accountId,
    eventType: "pos_customer.account_status_changed",
    before: {
      accountName: existing.accountName,
      phone: existing.phone,
      email: existing.email,
      status: beforeStatus,
    },
    after: {
      accountName: existing.accountName,
      phone: existing.phone,
      email: existing.email,
      status: input.data.status,
    },
    reason: input.data.reason,
    ipAddress: input.requestMeta?.ipAddress,
    userAgent: input.requestMeta?.userAgent,
  });

  return requireAccount(
    await findPosAccountById(db, tenantId, input.accountId),
  );
}

export async function deletePosAccount(
  input: DeletePosAccountInput,
  db: Database = getDb(),
): Promise<void> {
  const normalizedReason = authorizePosSensitiveOperation(
    input.authContext,
    "delete",
    input.reason,
  );
  requireAnyPosBranchAccess(input.authContext);
  const tenantId = requirePosTenantId(input.authContext);

  const existing = requireAccount(
    await findPosAccountById(db, tenantId, input.accountId),
  );

  // Soft delete cascade: profiles first, then the account itself.
  await cascadeSoftDeleteProfilesByAccount(
    db,
    tenantId,
    input.accountId,
    input.authContext.userId,
  );
  await softDeletePosAccount(db, tenantId, input.accountId, input.authContext.userId);

  await writePosAccountAuditLog(db, {
    ...customerAuditContext(input.authContext),
    actorUserId: input.authContext.userId,
    tenantId,
    accountId: input.accountId,
    eventType: "pos_customer.account_deleted",
    before: {
      accountName: existing.accountName,
      phone: existing.phone,
      email: existing.email,
      status: existing.status,
    },
    after: { deleted: true },
    reason: normalizedReason,
    ipAddress: input.requestMeta?.ipAddress,
    userAgent: input.requestMeta?.userAgent,
  });
}

// ---- profiles: reads ------------------------------------------------------

export async function getPosProfile(
  input: GetPosProfileInput,
  db: Database = getDb(),
): Promise<PosCustomerProfileDetail> {
  requireAnyPosBranchAccess(input.authContext);
  const profile = await findPosProfileById(
    db,
    input.authContext.tenantId!,
    input.customerId,
  );
  return requireProfile(profile);
}

export async function getPosCustomerOrderStats(
  input: GetPosCustomerOrderStatsInput,
  db: Database = getDb(),
): Promise<PosCustomerOrderStats> {
  const tenantId = requirePosTenantId(input.authContext);
  const allowedBranchIds = resolvePosBranchScope(input.authContext);

  if (allowedBranchIds?.length === 0) {
    return { orderCount: 0, totalPaid: "0" };
  }

  requireProfile(await findPosProfileById(db, tenantId, input.customerId));

  return findPosCustomerOrderStats(
    db,
    tenantId,
    input.customerId,
    allowedBranchIds,
  );
}

export async function listPosCustomerServiceItems(
  input: ListPosCustomerServiceItemsInput,
  db: Database = getDb(),
): Promise<ListPosCustomerServiceItemsResult> {
  const tenantId = requirePosTenantId(input.authContext);
  const allowedBranchIds = resolvePosBranchScope(input.authContext);

  if (allowedBranchIds?.length === 0) {
    return {
      data: [],
      total: 0,
      limit: input.query.limit,
      offset: input.query.offset,
    };
  }

  requireProfile(await findPosProfileById(db, tenantId, input.customerId));

  return findPosCustomerServiceItems(
    db,
    tenantId,
    input.customerId,
    {
      ...input.query,
      allowedBranchIds,
    },
  );
}

// ---- profiles: writes -----------------------------------------------------

export async function createPosProfile(
  input: CreatePosProfileInput,
  db: Database = getDb(),
): Promise<PosCustomerProfileDetail> {
  requireAnyPosBranchAccess(input.authContext);
  const tenantId = requirePosTenantId(input.authContext);

  if (input.data.id) {
    const existing = await findPosProfileById(db, tenantId, input.data.id);
    if (existing) {
      if (existing.customerAccountId !== input.accountId) {
        throw new PosCustomerError(
          "POS_CUSTOMER_ID_CONFLICT",
          "The customer profile id is already used by another account.",
          409,
        );
      }
      return existing;
    }
  }

  // Profile must be created under an existing, non-deleted account in this
  // tenant. A disabled account cannot receive new profiles (the "new profile"
  // button in the UI only appears under an active account).
  const account = requireAccount(
    await findPosAccountById(db, tenantId, input.accountId),
  );

  if (account.status === "disabled") {
    throw new PosCustomerError(
      "POS_ACCOUNT_DISABLED",
      "Cannot create a profile under a disabled customer account.",
      403,
    );
  }

  const profile = await insertPosProfile(db, {
    id: input.data.id,
    actorUserId: input.authContext.userId,
    tenantId,
    customerAccountId: input.accountId,
    fullName: input.data.fullName,
    phone: input.data.phone,
    email: input.data.email,
    relationship: input.data.relationship,
    address: input.data.address,
    notes: input.data.notes,
  });

  await writePosProfileAuditLog(db, {
    ...customerAuditContext(input.authContext),
    actorUserId: input.authContext.userId,
    tenantId,
    customerId: profile.id,
    eventType: "pos_customer.profile_created",
    after: {
      customerAccountId: profile.customerAccountId,
      fullName: profile.fullName,
      phone: profile.phone,
      email: profile.email,
      relationship: profile.relationship,
      address: profile.address,
      notes: profile.notes,
      status: profile.status,
    },
    ipAddress: input.requestMeta?.ipAddress,
    userAgent: input.requestMeta?.userAgent,
  });

  return profile;
}

export async function updatePosProfile(
  input: UpdatePosProfileInput,
  db: Database = getDb(),
): Promise<PosCustomerProfileDetail> {
  requireAnyPosBranchAccess(input.authContext);
  const tenantId = requirePosTenantId(input.authContext);

  requireProfile(await findPosProfileById(db, tenantId, input.customerId));

  const before = await findPosProfileAuditSnapshot(db, tenantId, input.customerId);

  await updatePosProfileRecord(db, {
    tenantId,
    customerId: input.customerId,
    actorUserId: input.authContext.userId,
    fullName: input.data.fullName,
    phone: input.data.phone,
    email: input.data.email,
    relationship: input.data.relationship,
    address: input.data.address,
    notes: input.data.notes,
  });

  const updated = requireProfile(
    await findPosProfileById(db, tenantId, input.customerId),
  );

  const after = await findPosProfileAuditSnapshot(db, tenantId, input.customerId);

  if (before && after) {
    await writePosProfileAuditLog(db, {
      ...customerAuditContext(input.authContext),
      actorUserId: input.authContext.userId,
      tenantId,
      customerId: input.customerId,
      eventType: "pos_customer.profile_updated",
      before,
      after,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
  }

  return updated;
}

export async function changePosProfileStatus(
  input: ChangePosProfileStatusInput,
  db: Database = getDb(),
): Promise<PosCustomerProfileDetail> {
  requireAnyPosBranchAccess(input.authContext);
  const tenantId = requirePosTenantId(input.authContext);

  const existing = requireProfile(
    await findPosProfileById(db, tenantId, input.customerId),
  );

  if (existing.status === input.data.status) {
    throw new PosCustomerError(
      input.data.status === "disabled"
        ? "POS_CUSTOMER_ALREADY_DISABLED"
        : "POS_CUSTOMER_NOT_DISABLED",
      input.data.status === "disabled"
        ? "Customer profile is already disabled."
        : "Customer profile is not disabled.",
      409,
    );
  }

  const beforeStatus = existing.status;
  await setPosProfileStatus(
    db,
    tenantId,
    input.customerId,
    input.authContext.userId,
    input.data.status,
  );

  await writePosProfileAuditLog(db, {
    ...customerAuditContext(input.authContext),
    actorUserId: input.authContext.userId,
    tenantId,
    customerId: input.customerId,
    eventType: "pos_customer.profile_status_changed",
    before: {
      customerAccountId: existing.customerAccountId,
      fullName: existing.fullName,
      phone: existing.phone,
      email: existing.email,
      relationship: existing.relationship,
      address: existing.address,
      notes: existing.notes,
      status: beforeStatus,
    },
    after: {
      customerAccountId: existing.customerAccountId,
      fullName: existing.fullName,
      phone: existing.phone,
      email: existing.email,
      relationship: existing.relationship,
      address: existing.address,
      notes: existing.notes,
      status: input.data.status,
    },
    reason: input.data.reason,
    ipAddress: input.requestMeta?.ipAddress,
    userAgent: input.requestMeta?.userAgent,
  });

  return requireProfile(await findPosProfileById(db, tenantId, input.customerId));
}

export async function deletePosProfile(
  input: DeletePosProfileInput,
  db: Database = getDb(),
): Promise<void> {
  const normalizedReason = authorizePosSensitiveOperation(
    input.authContext,
    "delete",
    input.reason,
  );
  requireAnyPosBranchAccess(input.authContext);
  const tenantId = requirePosTenantId(input.authContext);

  const existing = requireProfile(
    await findPosProfileById(db, tenantId, input.customerId),
  );

  await softDeletePosProfile(db, tenantId, input.customerId, input.authContext.userId);

  await writePosProfileAuditLog(db, {
    ...customerAuditContext(input.authContext),
    actorUserId: input.authContext.userId,
    tenantId,
    customerId: input.customerId,
    eventType: "pos_customer.profile_deleted",
    before: {
      customerAccountId: existing.customerAccountId,
      fullName: existing.fullName,
      phone: existing.phone,
      email: existing.email,
      relationship: existing.relationship,
      address: existing.address,
      notes: existing.notes,
      status: existing.status,
    },
    after: { deleted: true },
    reason: normalizedReason,
    ipAddress: input.requestMeta?.ipAddress,
    userAgent: input.requestMeta?.userAgent,
  });
}
