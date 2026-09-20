import { getDb, type Database } from "@cleanhub/db";

import { writeAuditLog } from "../../audit/audit.helper.js";
import { hashPassword } from "../../auth/password.service.js";
import { CUSTOMER_STARTER_PASSWORD } from "../../auth/customer-starter-password.helper.js";
import { resolveAllowedBranchIds } from "../../auth/branch-scope.helper.js";
import { AuthError } from "../../auth/auth.errors.js";
import {
  assertActiveTenant,
  requireTenantRole,
} from "../../auth/permission.helper.js";
import {
  findTenantCustomerAccountConflict,
  findTenantCustomerAccountCustomers,
  findTenantCustomerAccountDetail,
  revokeTenantCustomerRefreshTokens,
  upsertTenantCustomerCredentialRecord,
  findTenantCustomerAccountOverview,
  findTenantCustomerAccounts,
  findTenantCustomerDetail,
  findTenantCustomerOverview,
  findTenantCustomers,
  updateTenantCustomerRecord,
  updateTenantCustomerAccountRecord,
} from "./customers.repository.js";
import type {
  TenantCustomerAccountCustomersInput,
  TenantCustomerAccountCustomersResponse,
  TenantCustomerAccountDetail,
  TenantCustomerAccountDetailInput,
  TenantCustomerAccountListInput,
  TenantCustomerAccountListResponse,
  TenantCustomerAccountOverview,
  TenantCustomerAccountOverviewInput,
  TenantCustomerDetail,
  TenantCustomerListInput,
  TenantCustomerListResponse,
  TenantCustomerOverview,
  TenantCustomerOverviewInput,
  UpdateTenantCustomerInput,
  UpdateTenantCustomerAccountInput,
  ResetTenantCustomerAccountPasswordInput,
  ResetTenantCustomerAccountPasswordResult,
} from "./customers.types.js";
import { TenantCustomersError } from "./customers.errors.js";

async function resolveTenantCustomerScope(
  authContext: TenantCustomerListInput["authContext"],
  branchId: string | undefined,
  db: Database,
): Promise<{ tenantId: string; allowedBranchIds?: string[] }> {
  requireTenantRole(authContext, ["owner", "manager"]);
  await assertActiveTenant(authContext, db);

  const branchScope = await resolveAllowedBranchIds(authContext, db);
  if (
    branchId &&
    branchScope !== "all" &&
    !branchScope.includes(branchId)
  ) {
    throw new AuthError(
      "FORBIDDEN",
      "User cannot access the requested branch.",
    );
  }

  return {
    tenantId: authContext.tenantId!,
    allowedBranchIds: branchScope === "all" ? undefined : branchScope,
  };
}

export async function listTenantCustomers(
  input: TenantCustomerListInput,
  db: Database = getDb(),
): Promise<TenantCustomerListResponse> {
  const scope = await resolveTenantCustomerScope(
    input.authContext,
    input.query.branchId,
    db,
  );

  return findTenantCustomers(db, {
    ...input.query,
    ...scope,
  });
}

export async function getTenantCustomerOverview(
  input: TenantCustomerOverviewInput,
  db: Database = getDb(),
): Promise<TenantCustomerOverview> {
  const scope = await resolveTenantCustomerScope(
    input.authContext,
    input.query.branchId,
    db,
  );

  return findTenantCustomerOverview(db, {
    ...input.query,
    ...scope,
  });
}

export async function getTenantCustomerDetail(
  authContext: TenantCustomerListInput["authContext"],
  customerId: string,
  db: Database = getDb(),
): Promise<TenantCustomerDetail> {
  const scope = await resolveTenantCustomerScope(authContext, undefined, db);
  const customer = await findTenantCustomerDetail(db, {
    ...scope,
    customerId,
  });

  if (!customer) {
    throw new TenantCustomersError(
      "CUSTOMER_NOT_FOUND",
      "Customer was not found.",
    );
  }

  return customer;
}

export async function updateTenantCustomer(
  input: UpdateTenantCustomerInput,
  db: Database = getDb(),
): Promise<TenantCustomerDetail> {
  const scope = await resolveTenantCustomerScope(
    input.authContext,
    undefined,
    db,
  );
  const existing = await findTenantCustomerDetail(db, {
    ...scope,
    customerId: input.customerId,
  });

  if (!existing) {
    throw new TenantCustomersError(
      "CUSTOMER_NOT_FOUND",
      "Customer was not found.",
    );
  }

  return db.transaction(async (tx) => {
    const updated = await updateTenantCustomerRecord(tx, {
      tenantId: scope.tenantId,
      customerId: input.customerId,
      actorUserId: input.authContext.userId,
      data: input.data,
    });

    if (!updated) {
      throw new TenantCustomersError(
        "CUSTOMER_VERSION_CONFLICT",
        "Customer changed before it could be saved.",
        409,
      );
    }

    const result = await findTenantCustomerDetail(tx, {
      ...scope,
      customerId: input.customerId,
    });
    if (!result) {
      throw new TenantCustomersError(
        "CUSTOMER_NOT_FOUND",
        "Customer was not found.",
      );
    }

    const before = {
      fullName: existing.fullName,
      phone: existing.phone,
      email: existing.email,
      relationship: existing.relationship,
      address: existing.address,
      notes: existing.notes,
      status: existing.status,
      version: existing.version,
    };
    const after = {
      fullName: result.fullName,
      phone: result.phone,
      email: result.email,
      relationship: result.relationship,
      address: result.address,
      notes: result.notes,
      status: result.status,
      version: result.version,
    };
    const statusOnlyUpdate =
      existing.status !== result.status &&
      existing.fullName === result.fullName &&
      existing.phone === result.phone &&
      existing.email === result.email &&
      existing.relationship === result.relationship &&
      existing.address === result.address &&
      existing.notes === result.notes;

    await writeAuditLog(tx, {
      tenantId: scope.tenantId,
      actorUserId: input.authContext.userId,
      eventCategory: "pos_customer",
      eventType: statusOnlyUpdate
        ? "pos_customer.profile_status_changed"
        : "pos_customer.profile_updated",
      entityType: "customer",
      entityId: input.customerId,
      before,
      after,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return result;
  });
}

export async function listTenantCustomerAccounts(
  input: TenantCustomerAccountListInput,
  db: Database = getDb(),
): Promise<TenantCustomerAccountListResponse> {
  const scope = await resolveTenantCustomerScope(
    input.authContext,
    undefined,
    db,
  );

  return findTenantCustomerAccounts(db, {
    ...input.query,
    ...scope,
  });
}

export async function getTenantCustomerAccountOverview(
  input: TenantCustomerAccountOverviewInput,
  db: Database = getDb(),
): Promise<TenantCustomerAccountOverview> {
  const scope = await resolveTenantCustomerScope(
    input.authContext,
    undefined,
    db,
  );

  return findTenantCustomerAccountOverview(db, scope);
}

export async function getTenantCustomerAccountDetail(
  input: TenantCustomerAccountDetailInput,
  db: Database = getDb(),
): Promise<TenantCustomerAccountDetail> {
  const scope = await resolveTenantCustomerScope(
    input.authContext,
    undefined,
    db,
  );
  const account = await findTenantCustomerAccountDetail(db, {
    ...scope,
    accountId: input.accountId,
  });

  if (!account) {
    throw new TenantCustomersError(
      "ACCOUNT_NOT_FOUND",
      "Customer account was not found.",
    );
  }

  return account;
}

export async function listTenantCustomerAccountCustomers(
  input: TenantCustomerAccountCustomersInput,
  db: Database = getDb(),
): Promise<TenantCustomerAccountCustomersResponse> {
  const scope = await resolveTenantCustomerScope(
    input.authContext,
    undefined,
    db,
  );
  const account = await findTenantCustomerAccountDetail(db, {
    ...scope,
    accountId: input.accountId,
  });

  if (!account) {
    throw new TenantCustomersError(
      "ACCOUNT_NOT_FOUND",
      "Customer account was not found.",
    );
  }

  return findTenantCustomerAccountCustomers(db, {
    ...input.query,
    ...scope,
    accountId: input.accountId,
  });
}

export async function updateTenantCustomerAccount(
  input: UpdateTenantCustomerAccountInput,
  db: Database = getDb(),
): Promise<TenantCustomerAccountDetail> {
  const scope = await resolveTenantCustomerScope(
    input.authContext,
    undefined,
    db,
  );
  const existing = await findTenantCustomerAccountDetail(db, {
    ...scope,
    accountId: input.accountId,
  });

  if (!existing) {
    throw new TenantCustomersError(
      "ACCOUNT_NOT_FOUND",
      "Customer account was not found.",
    );
  }

  const nextPhone =
    input.data.phone === undefined
      ? existing.phone
      : input.data.phone?.trim() || null;
  const nextEmail =
    input.data.email === undefined
      ? existing.email
      : input.data.email?.trim().toLowerCase() || null;

  if (!nextPhone && !nextEmail) {
    throw new TenantCustomersError(
      "ACCOUNT_CONTACT_REQUIRED",
      "At least one of phone or email is required.",
      422,
    );
  }

  const conflict = await findTenantCustomerAccountConflict(db, {
    tenantId: scope.tenantId,
    accountId: input.accountId,
    phone: nextPhone,
    email: nextEmail,
  });
  if (conflict) {
    throw new TenantCustomersError(
      conflict === "phone"
        ? "ACCOUNT_PHONE_CONFLICT"
        : "ACCOUNT_EMAIL_CONFLICT",
      conflict === "phone"
        ? "A customer account with this phone already exists."
        : "A customer account with this email already exists.",
      409,
    );
  }

  return db.transaction(async (tx) => {
    const updated = await updateTenantCustomerAccountRecord(tx, {
      tenantId: scope.tenantId,
      accountId: input.accountId,
      actorUserId: input.authContext.userId,
      data: input.data,
    });

    if (!updated) {
      throw new TenantCustomersError(
        "ACCOUNT_VERSION_CONFLICT",
        "Customer account changed before it could be saved.",
        409,
      );
    }

    const result = {
      ...updated,
      customerCount: existing.customerCount,
    };
    const before = {
      accountName: existing.accountName,
      phone: existing.phone,
      email: existing.email,
      status: existing.status,
      version: existing.version,
    };
    const after = {
      accountName: result.accountName,
      phone: result.phone,
      email: result.email,
      status: result.status,
      version: result.version,
    };
    const statusOnlyUpdate =
      input.data.status !== undefined &&
      input.data.accountName === undefined &&
      input.data.phone === undefined &&
      input.data.email === undefined;

    await writeAuditLog(tx, {
      tenantId: scope.tenantId,
      actorUserId: input.authContext.userId,
      eventCategory: "pos_customer",
      eventType: statusOnlyUpdate
        ? "pos_customer.account_status_changed"
        : "pos_customer.account_updated",
      entityType: "customer_account",
      entityId: input.accountId,
      before,
      after,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return result;
  });
}

/**
 * Issue a customer a password so they can sign in to the mobile app.
 *
 * Customer sign-in is otherwise OTP-first, and the OTP is generated but never
 * delivered -- there is no SMS provider -- so a customer who has never had a
 * password has no way into the app at all. Staff create the account at the
 * counter, so staff hand over the first credential too; the customer changes it
 * from the app afterwards.
 *
 * Owner or manager only, through the same branch-scoped guard as the rest of
 * this module, and always audited: this is a credential for someone else's
 * account.
 */
export async function resetTenantCustomerAccountPassword(
  input: ResetTenantCustomerAccountPasswordInput,
  db: Database = getDb(),
): Promise<ResetTenantCustomerAccountPasswordResult> {
  const scope = await resolveTenantCustomerScope(
    input.authContext,
    undefined,
    db,
  );
  const existing = await findTenantCustomerAccountDetail(db, {
    ...scope,
    accountId: input.accountId,
  });

  if (!existing) {
    throw new TenantCustomersError(
      "ACCOUNT_NOT_FOUND",
      "Customer account was not found.",
    );
  }

  // A disabled account must not be handed a working credential; re-enable it
  // first so the decision to restore access is explicit and separately audited.
  if (existing.status === "disabled") {
    throw new TenantCustomersError(
      "ACCOUNT_DISABLED",
      "Enable the customer account before issuing a password.",
      422,
    );
  }

  // Not checked against the security policy, and not generated: the starter is
  // a fixed value staff read out at the counter. `mustChangePassword` is what
  // protects the account until the customer picks a real one, and that new
  // password IS policy-checked when they set it.
  const passwordHash = await hashPassword(CUSTOMER_STARTER_PASSWORD);

  return db.transaction(async (tx) => {
    await upsertTenantCustomerCredentialRecord(tx, {
      tenantId: scope.tenantId,
      customerAccountId: input.accountId,
      passwordHash,
      mustChangePassword: true,
      actorUserId: input.authContext.userId,
    });

    // Any session opened with the old credential stops here.
    await revokeTenantCustomerRefreshTokens(tx, {
      tenantId: scope.tenantId,
      customerAccountId: input.accountId,
    });

    await writeAuditLog(tx, {
      tenantId: scope.tenantId,
      actorUserId: input.authContext.userId,
      eventCategory: "pos_customer",
      eventType: "pos_customer.account_password_reset",
      entityType: "customer_account",
      entityId: input.accountId,
      success: true,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return { accountId: input.accountId, password: CUSTOMER_STARTER_PASSWORD };
  });
}
