import { getDb, type Database } from "@cleanhub/db";

import type { AuthContext } from "../../auth/auth.types.js";
import { resolveAllowedBranchIds } from "../../auth/branch-scope.helper.js";
import {
  assertActiveTenant,
  assertTenantContext,
  requireTenantRole,
} from "../../auth/permission.helper.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import { TenantDiscountsError } from "./discounts.errors.js";
import {
  countDiscounts,
  createDiscountRecord,
  findActiveBranchIds,
  findDiscountCodeOwner,
  findDiscountDetail,
  findDiscountListOptions,
  findDiscountOptions,
  findDiscountOverview,
  findDiscountReferenceValidation,
  findDiscounts,
  softDeleteDiscountRecord,
  updateDiscountEnabledRecord,
  updateDiscountRecord,
} from "./discounts.repository.js";
import type {
  CreateDiscountRequest,
  DeleteDiscountRequest,
  DiscountDetail,
  DiscountListQuery,
  DiscountListOptions,
  DiscountListResponse,
  DiscountOptions,
  DiscountRepositoryDetail,
  DiscountRepositoryScope,
  DiscountRepositorySummary,
  DiscountRequestInput,
  DiscountSummary,
  UpdateDiscountRequest,
  UpdateDiscountStatusRequest,
} from "./discounts.types.js";
import { createDiscountBodySchema } from "./discounts.validation.js";

type DiscountAccess = {
  role: "owner" | "manager";
  scope: DiscountRepositoryScope;
  activeBranchIds: string[];
};

function getTenantId(authContext: AuthContext): string {
  assertTenantContext(authContext);
  return authContext.tenantId!;
}

async function resolveDiscountAccess(
  authContext: AuthContext,
  db: Database,
): Promise<DiscountAccess> {
  const tenantId = getTenantId(authContext);
  requireTenantRole(authContext, ["owner", "manager"]);
  await assertActiveTenant(authContext, db);

  const branchScope = await resolveAllowedBranchIds(authContext, db);
  const initialScope: DiscountRepositoryScope = {
    tenantId,
    allowedBranchIds: branchScope === "all" ? undefined : branchScope,
  };
  const activeBranchIds = await findActiveBranchIds(db, initialScope);

  return {
    role: authContext.role as "owner" | "manager",
    scope: {
      tenantId,
      allowedBranchIds: branchScope === "all" ? undefined : activeBranchIds,
    },
    activeBranchIds,
  };
}

function canManageRecord(
  access: DiscountAccess,
  record: Pick<DiscountRepositorySummary, "allBranches" | "scopeBranchIds">,
): boolean {
  if (access.role === "owner") return true;
  if (record.allBranches || record.scopeBranchIds.length === 0) return false;

  const allowed = new Set(access.activeBranchIds);
  return record.scopeBranchIds.every((branchId) => allowed.has(branchId));
}

function toSummary(
  access: DiscountAccess,
  record: DiscountRepositorySummary,
): DiscountSummary {
  const { scopeBranchIds: _scopeBranchIds, ...summary } = record;

  return {
    ...summary,
    canManage: canManageRecord(access, record),
  };
}

function toDetail(
  access: DiscountAccess,
  record: DiscountRepositoryDetail,
): DiscountDetail {
  const { scopeBranchIds: _scopeBranchIds, ...detail } = record;

  return {
    ...detail,
    canManage: canManageRecord(access, record),
  };
}

function requireManageRecord(
  access: DiscountAccess,
  record: Pick<DiscountRepositorySummary, "allBranches" | "scopeBranchIds">,
): void {
  if (!canManageRecord(access, record)) {
    throw new TenantDiscountsError(
      "DISCOUNT_FORBIDDEN",
      "This discount cannot be managed with the current branch scope.",
      403,
    );
  }
}

function requireCreateScope(
  access: DiscountAccess,
  data: CreateDiscountRequest,
): void {
  if (access.role === "owner") return;
  if (data.allBranches) {
    throw new TenantDiscountsError(
      "DISCOUNT_FORBIDDEN",
      "Managers cannot create all-branch discounts.",
      403,
    );
  }

  const allowed = new Set(access.activeBranchIds);
  if (
    data.branchIds.length === 0 ||
    data.branchIds.some((branchId) => !allowed.has(branchId))
  ) {
    throw new TenantDiscountsError(
      "DISCOUNT_FORBIDDEN",
      "Discount branch assignment exceeds the manager's branch scope.",
      403,
    );
  }
}

function currentConfiguration(
  detail: DiscountRepositoryDetail,
): CreateDiscountRequest {
  return {
    title: detail.title,
    method: detail.method,
    type: detail.type,
    enabled: detail.enabled,
    code: detail.code,
    valueType: detail.valueType!,
    valueAmount: detail.valueAmount,
    currency: detail.currency,
    eligibility: detail.eligibility,
    minimumRequirement: detail.minimumRequirement,
    minimumPurchaseAmount: detail.minimumPurchaseAmount,
    minimumQuantity: detail.minimumQuantity,
    usageLimit: detail.usageLimit,
    oncePerCustomer: detail.oncePerCustomer,
    combinesWithItemDiscounts: detail.combinesWithItemDiscounts,
    combinesWithOrderDiscounts: detail.combinesWithOrderDiscounts,
    combinesWithShippingDiscounts: detail.combinesWithShippingDiscounts,
    startsAt: detail.startsAt,
    endsAt: detail.endsAt,
    allBranches: detail.allBranches,
    branchIds: detail.branchIds,
    channels: {
      posEnabled: detail.posEnabled,
      customerMobileEnabled: detail.customerMobileEnabled,
      deliveryEnabled: detail.deliveryEnabled,
    },
    buyRequirementType: detail.buyRequirementType,
    buyRequirementValue: detail.buyRequirementValue,
    getQuantity: detail.getQuantity,
    maxUsesPerOrder: detail.maxUsesPerOrder,
    countryScope: detail.countryScope,
    countryCodes: detail.countryCodes,
    maximumShippingPrice: detail.maximumShippingPrice,
    tags: detail.tags,
    targets: detail.targets,
    customerIds: detail.customerIds,
  };
}

function mergeUpdate(
  before: DiscountRepositoryDetail,
  update: UpdateDiscountRequest,
): CreateDiscountRequest {
  const current = currentConfiguration(before);
  const { version: _version, ...fields } = update;
  const merged = { ...current, ...fields };

  if (fields.method === "automatic" && fields.code === undefined) {
    merged.code = null;
  }
  if (
    fields.eligibility === "all_customers" &&
    fields.customerIds === undefined
  ) {
    merged.customerIds = [];
  }
  if (fields.allBranches === true && fields.branchIds === undefined) {
    merged.branchIds = [];
  }
  if (
    fields.minimumRequirement === "none" &&
    fields.minimumPurchaseAmount === undefined &&
    fields.minimumQuantity === undefined
  ) {
    merged.minimumPurchaseAmount = null;
    merged.minimumQuantity = null;
  }

  return createDiscountBodySchema.parse(merged);
}

async function requireReferences(
  db: Database,
  access: DiscountAccess,
  data: CreateDiscountRequest,
): Promise<void> {
  requireCreateScope(access, data);
  const references = await findDiscountReferenceValidation(
    db,
    access.scope.tenantId,
    data,
  );
  const missingBranch = data.branchIds.some(
    (branchId) => !references.branchIds.has(branchId),
  );
  const missingTarget = data.targets.some((target) => {
    if (target.targetType === "product") {
      return !references.productIds.has(target.targetId);
    }
    if (target.targetType === "product_category") {
      return !references.productCategoryIds.has(target.targetId);
    }
    if (target.targetType === "service") {
      return !references.serviceIds.has(target.targetId);
    }
    return !references.serviceCategoryIds.has(target.targetId);
  });
  const missingCustomer = data.customerIds.some(
    (customerId) => !references.customerIds.has(customerId),
  );

  if (missingBranch) {
    throw new TenantDiscountsError(
      "DISCOUNT_BRANCH_NOT_FOUND",
      "One or more discount branches were not found.",
      404,
    );
  }
  if (missingTarget || missingCustomer) {
    throw new TenantDiscountsError(
      "DISCOUNT_REFERENCE_INVALID",
      "One or more discount targets or customers are invalid.",
      422,
    );
  }
}

async function requireUniqueCode(
  db: Database,
  tenantId: string,
  data: CreateDiscountRequest,
  excludeDiscountId?: string,
): Promise<void> {
  if (data.method !== "code" || !data.code) return;

  const owner = await findDiscountCodeOwner(db, {
    tenantId,
    code: data.code,
    excludeDiscountId,
  });
  if (owner) {
    throw new TenantDiscountsError(
      "DISCOUNT_CODE_DUPLICATE",
      "Discount code already exists.",
      409,
    );
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (
      typeof current === "object" &&
      "code" in current &&
      (current as { code?: unknown }).code === "23505"
    ) {
      return true;
    }
    current =
      typeof current === "object" && "cause" in current
        ? (current as { cause?: unknown }).cause
        : undefined;
  }
  return false;
}

function versionConflict(): TenantDiscountsError {
  return new TenantDiscountsError(
    "DISCOUNT_VERSION_CONFLICT",
    "Discount has been modified. Refresh and try again.",
    409,
  );
}

async function loadDiscountOrThrow(
  db: Database,
  access: DiscountAccess,
  discountId: string,
): Promise<DiscountRepositoryDetail> {
  const detail = await findDiscountDetail(db, access.scope, discountId);
  if (!detail) {
    throw new TenantDiscountsError(
      "DISCOUNT_NOT_FOUND",
      "Discount was not found.",
      404,
    );
  }
  return detail;
}

export async function getTenantDiscountOverview(
  authContext: AuthContext,
  db: Database = getDb(),
) {
  const access = await resolveDiscountAccess(authContext, db);
  return findDiscountOverview(db, access.scope);
}

export async function listTenantDiscounts(
  authContext: AuthContext,
  query: DiscountListQuery,
  db: Database = getDb(),
): Promise<DiscountListResponse> {
  const access = await resolveDiscountAccess(authContext, db);
  if (query.branchId && !access.activeBranchIds.includes(query.branchId)) {
    throw new TenantDiscountsError(
      "DISCOUNT_BRANCH_NOT_FOUND",
      "Branch was not found.",
      404,
    );
  }
  const now = new Date();
  const [records, total] = await Promise.all([
    findDiscounts(db, access.scope, query, now),
    countDiscounts(db, access.scope, query, now),
  ]);

  return {
    data: records.map((record) => toSummary(access, record)),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getTenantDiscountOptions(
  authContext: AuthContext,
  db: Database = getDb(),
): Promise<DiscountOptions> {
  const access = await resolveDiscountAccess(authContext, db);
  const options = await findDiscountOptions(db, access.scope);

  return {
    ...options,
    canManage: access.role === "owner" || access.activeBranchIds.length > 0,
    canManageAllBranches: access.role === "owner",
  };
}

export async function getTenantDiscountListOptions(
  authContext: AuthContext,
  db: Database = getDb(),
): Promise<DiscountListOptions> {
  const access = await resolveDiscountAccess(authContext, db);
  const options = await findDiscountListOptions(db, access.scope);

  return {
    ...options,
    canManage: access.role === "owner" || access.activeBranchIds.length > 0,
    canManageAllBranches: access.role === "owner",
  };
}

export async function getTenantDiscountDetail(
  authContext: AuthContext,
  discountId: string,
  db: Database = getDb(),
): Promise<DiscountDetail> {
  const access = await resolveDiscountAccess(authContext, db);
  return toDetail(access, await loadDiscountOrThrow(db, access, discountId));
}

export async function createTenantDiscount(
  input: DiscountRequestInput<CreateDiscountRequest>,
  db: Database = getDb(),
): Promise<DiscountDetail> {
  const access = await resolveDiscountAccess(input.authContext, db);
  const data = createDiscountBodySchema.parse(input.data);
  await requireReferences(db, access, data);

  try {
    return await db.transaction(async (tx) => {
      await requireUniqueCode(tx, access.scope.tenantId, data);
      const discountId = await createDiscountRecord(tx, {
        ...data,
        tenantId: access.scope.tenantId,
        actorUserId: input.authContext.userId,
      });
      const created = await loadDiscountOrThrow(tx, access, discountId);
      const response = toDetail(access, created);

      await writeAuditLog(tx, {
        actorUserId: input.authContext.userId,
        tenantId: access.scope.tenantId,
        eventCategory: "tenant_discount",
        eventType: "discount.created",
        entityType: "discount",
        entityId: discountId,
        after: response,
        ipAddress: input.requestMeta?.ipAddress,
        userAgent: input.requestMeta?.userAgent,
      });
      return response;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new TenantDiscountsError(
        "DISCOUNT_CODE_DUPLICATE",
        "Discount code already exists.",
        409,
      );
    }
    throw error;
  }
}

export async function updateTenantDiscount(
  discountId: string,
  input: DiscountRequestInput<UpdateDiscountRequest>,
  db: Database = getDb(),
): Promise<DiscountDetail> {
  const access = await resolveDiscountAccess(input.authContext, db);

  try {
    return await db.transaction(async (tx) => {
      const before = await loadDiscountOrThrow(tx, access, discountId);
      requireManageRecord(access, before);
      const data = mergeUpdate(before, input.data);
      await requireReferences(tx, access, data);
      await requireUniqueCode(tx, access.scope.tenantId, data, discountId);

      const updated = await updateDiscountRecord(tx, {
        ...data,
        tenantId: access.scope.tenantId,
        discountId,
        actorUserId: input.authContext.userId,
        version: input.data.version,
      });
      if (!updated) throw versionConflict();

      const after = await loadDiscountOrThrow(tx, access, discountId);
      const response = toDetail(access, after);
      await writeAuditLog(tx, {
        actorUserId: input.authContext.userId,
        tenantId: access.scope.tenantId,
        eventCategory: "tenant_discount",
        eventType: "discount.updated",
        entityType: "discount",
        entityId: discountId,
        before: toDetail(access, before),
        after: response,
        ipAddress: input.requestMeta?.ipAddress,
        userAgent: input.requestMeta?.userAgent,
      });
      return response;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new TenantDiscountsError(
        "DISCOUNT_CODE_DUPLICATE",
        "Discount code already exists.",
        409,
      );
    }
    throw error;
  }
}

export async function updateTenantDiscountStatus(
  discountId: string,
  input: DiscountRequestInput<UpdateDiscountStatusRequest>,
  db: Database = getDb(),
): Promise<DiscountDetail> {
  const access = await resolveDiscountAccess(input.authContext, db);

  return db.transaction(async (tx) => {
    const before = await loadDiscountOrThrow(tx, access, discountId);
    requireManageRecord(access, before);
    const updated = await updateDiscountEnabledRecord(tx, {
      tenantId: access.scope.tenantId,
      discountId,
      enabled: input.data.enabled,
      version: input.data.version,
      actorUserId: input.authContext.userId,
    });
    if (!updated) throw versionConflict();

    const after = await loadDiscountOrThrow(tx, access, discountId);
    const response = toDetail(access, after);
    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId: access.scope.tenantId,
      eventCategory: "tenant_discount",
      eventType: "discount.status_changed",
      entityType: "discount",
      entityId: discountId,
      before: { enabled: before.enabled, status: before.status },
      after: { enabled: after.enabled, status: after.status },
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
    return response;
  });
}

export async function deleteTenantDiscount(
  discountId: string,
  input: DiscountRequestInput<DeleteDiscountRequest>,
  db: Database = getDb(),
): Promise<void> {
  const access = await resolveDiscountAccess(input.authContext, db);

  await db.transaction(async (tx) => {
    const before = await loadDiscountOrThrow(tx, access, discountId);
    requireManageRecord(access, before);
    const deleted = await softDeleteDiscountRecord(tx, {
      tenantId: access.scope.tenantId,
      discountId,
      version: input.data.version,
      actorUserId: input.authContext.userId,
    });
    if (!deleted) throw versionConflict();

    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId: access.scope.tenantId,
      eventCategory: "tenant_discount",
      eventType: "discount.deleted",
      entityType: "discount",
      entityId: discountId,
      before: toDetail(access, before),
      after: { deleted: true },
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
  });
}
