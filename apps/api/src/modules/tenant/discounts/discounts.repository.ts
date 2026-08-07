import {
  and,
  asc,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  branchProductSettings,
  branches,
  customers,
  discountBranches,
  discountCodes,
  discountCustomers,
  discounts,
  discountTargets,
  orderDiscountApplications,
  orders,
  productCategories,
  productSkus,
  products,
  serviceCategories,
  services,
  tenantSettings,
  type Database,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type {
  CreateDiscountRequest,
  DiscountDerivedStatus,
  DiscountListQuery,
  DiscountOptions,
  DiscountOverview,
  DiscountReferenceValidation,
  DiscountRepositoryDetail,
  DiscountRepositoryScope,
  DiscountRepositorySummary,
  DiscountTargetInput,
} from "./discounts.types.js";

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function derivedStatusExpression(now: Date) {
  return sql<DiscountDerivedStatus>`case
    when not ${discounts.enabled} then 'inactive'
    when ${discounts.startsAt} > ${now} then 'scheduled'
    when ${discounts.endsAt} is not null and ${discounts.endsAt} <= ${now} then 'expired'
    else 'active'
  end`;
}

function codeExpression() {
  return sql<string | null>`(
    select discount_codes.code
    from discount_codes
    where discount_codes.tenant_id = discounts.tenant_id
      and discount_codes.discount_id = discounts.id
      and discount_codes.deleted_at is null
    limit 1
  )`;
}

function branchCountExpression() {
  return sql<number>`(
    select count(*)::int
    from discount_branches
    where discount_branches.tenant_id = discounts.tenant_id
      and discount_branches.discount_id = discounts.id
  )`;
}

function scopeBranchIdsExpression() {
  return sql<string[]>`coalesce((
    select array_agg(discount_branches.branch_id order by discount_branches.branch_id)
    from discount_branches
    where discount_branches.tenant_id = discounts.tenant_id
      and discount_branches.discount_id = discounts.id
  ), array[]::varchar[])`;
}

function usageCountExpression(scope: DiscountRepositoryScope) {
  const branchCondition =
    scope.allowedBranchIds === undefined
      ? undefined
      : scope.allowedBranchIds.length === 0
        ? sql`false`
        : sql`order_discount_applications.branch_id in (${sql.join(
            scope.allowedBranchIds.map((branchId) => sql`${branchId}`),
            sql`, `,
          )})`;

  return sql<number>`(
    select count(*)::int
    from order_discount_applications
    inner join orders as discount_usage_orders
      on discount_usage_orders.tenant_id = order_discount_applications.tenant_id
      and discount_usage_orders.id = order_discount_applications.order_id
    where order_discount_applications.tenant_id = discounts.tenant_id
      and order_discount_applications.discount_id = discounts.id
      and order_discount_applications.status = 'applied'
      and discount_usage_orders.status in ('paid', 'delivered')
      and discount_usage_orders.payment_status = 'paid'
      and discount_usage_orders.deleted_at is null
      and ${branchCondition ?? sql`true`}
  )`;
}

function buildVisibilityCondition(
  scope: DiscountRepositoryScope,
): SQL | undefined {
  if (scope.allowedBranchIds === undefined) {
    return undefined;
  }
  if (scope.allowedBranchIds.length === 0) {
    return sql`false`;
  }

  return or(
    eq(discounts.allBranches, true),
    sql`exists (
      select 1
      from discount_branches
      where discount_branches.tenant_id = discounts.tenant_id
        and discount_branches.discount_id = discounts.id
        and discount_branches.branch_id in (${sql.join(
          scope.allowedBranchIds.map((branchId) => sql`${branchId}`),
          sql`, `,
        )})
    )`,
  );
}

function buildBranchApplicabilityCondition(branchId: string): SQL {
  return or(
    eq(discounts.allBranches, true),
    sql`exists (
      select 1
      from discount_branches
      where discount_branches.tenant_id = discounts.tenant_id
        and discount_branches.discount_id = discounts.id
        and discount_branches.branch_id = ${branchId}
    )`,
  )!;
}

function buildSummarySelect(now: Date, scope: DiscountRepositoryScope) {
  return {
    id: discounts.id,
    title: discounts.title,
    method: discounts.method,
    type: discounts.type,
    status: derivedStatusExpression(now),
    enabled: discounts.enabled,
    code: codeExpression(),
    valueType: discounts.valueType,
    valueAmount: discounts.valueAmount,
    currency: discounts.currency,
    startsAt: discounts.startsAt,
    endsAt: discounts.endsAt,
    allBranches: discounts.allBranches,
    branchCount: branchCountExpression(),
    scopeBranchIds: scopeBranchIdsExpression(),
    usageCount: usageCountExpression(scope),
    usageLimit: discounts.usageLimit,
    oncePerCustomer: discounts.oncePerCustomer,
    combinesWithItemDiscounts: discounts.combinesWithItemDiscounts,
    combinesWithOrderDiscounts: discounts.combinesWithOrderDiscounts,
    combinesWithShippingDiscounts: discounts.combinesWithShippingDiscounts,
    posEnabled: discounts.posEnabled,
    updatedAt: discounts.updatedAt,
    version: discounts.version,
  };
}

type SummaryRow = Omit<
  DiscountRepositorySummary,
  "startsAt" | "endsAt" | "updatedAt"
> & {
  startsAt: Date;
  endsAt: Date | null;
  updatedAt: Date;
};

function toSummary(row: SummaryRow): DiscountRepositorySummary {
  return {
    ...row,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildListFilters(
  scope: DiscountRepositoryScope,
  query: DiscountListQuery,
  now: Date,
): SQL[] {
  const filters: SQL[] = [
    eq(discounts.tenantId, scope.tenantId),
    isNull(discounts.deletedAt),
  ];
  const visibility = buildVisibilityCondition(scope);
  if (visibility) filters.push(visibility);
  if (query.status) {
    filters.push(sql`${derivedStatusExpression(now)} = ${query.status}`);
  }
  if (query.method) filters.push(eq(discounts.method, query.method));
  if (query.type) filters.push(eq(discounts.type, query.type));
  if (query.branchId) {
    filters.push(buildBranchApplicabilityCondition(query.branchId));
  }
  if (query.q) {
    const pattern = `%${escapeLikePattern(query.q)}%`;
    filters.push(
      or(
        ilike(discounts.title, pattern),
        sql`exists (
          select 1
          from discount_codes
          where discount_codes.tenant_id = discounts.tenant_id
            and discount_codes.discount_id = discounts.id
            and discount_codes.deleted_at is null
            and discount_codes.code ilike ${pattern} escape '\\'
        )`,
        sql`exists (
          select 1
          from jsonb_array_elements_text(${discounts.tags}) as discount_tag(value)
          where discount_tag.value ilike ${pattern} escape '\\'
        )`,
      )!,
    );
  }
  return filters;
}

function listOrderBy(
  sort: DiscountListQuery["sort"],
  scope: DiscountRepositoryScope,
): SQL[] {
  if (sort === "created_asc") {
    return [asc(discounts.createdAt), asc(discounts.id)];
  }
  if (sort === "updated_desc") {
    return [desc(discounts.updatedAt), desc(discounts.id)];
  }
  if (sort === "title_asc") {
    return [asc(discounts.title), asc(discounts.id)];
  }
  if (sort === "title_desc") {
    return [desc(discounts.title), desc(discounts.id)];
  }
  if (sort === "starts_at_desc") {
    return [desc(discounts.startsAt), desc(discounts.id)];
  }
  if (sort === "usage_desc") {
    return [desc(usageCountExpression(scope)), desc(discounts.createdAt)];
  }
  return [desc(discounts.createdAt), desc(discounts.id)];
}

export async function findDiscounts(
  db: Database,
  scope: DiscountRepositoryScope,
  query: DiscountListQuery,
  now = new Date(),
): Promise<DiscountRepositorySummary[]> {
  const rows = await db
    .select(buildSummarySelect(now, scope))
    .from(discounts)
    .where(and(...buildListFilters(scope, query, now)))
    .orderBy(...listOrderBy(query.sort, scope))
    .limit(query.limit)
    .offset(query.offset);

  return rows.map((row) => toSummary(row as SummaryRow));
}

export async function countDiscounts(
  db: Database,
  scope: DiscountRepositoryScope,
  query: DiscountListQuery,
  now = new Date(),
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(discounts)
    .where(and(...buildListFilters(scope, query, now)));

  return rows[0]?.count ?? 0;
}

export async function findDiscountDetail(
  db: Database,
  scope: DiscountRepositoryScope,
  discountId: string,
  now = new Date(),
): Promise<DiscountRepositoryDetail | null> {
  const visibility = buildVisibilityCondition(scope);
  const rows = await db
    .select({
      ...buildSummarySelect(now, scope),
      tenantId: discounts.tenantId,
      eligibility: discounts.eligibility,
      minimumRequirement: discounts.minimumRequirement,
      minimumPurchaseAmount: discounts.minimumPurchaseAmount,
      minimumQuantity: discounts.minimumQuantity,
      combinesWithItemDiscounts: discounts.combinesWithItemDiscounts,
      combinesWithOrderDiscounts: discounts.combinesWithOrderDiscounts,
      combinesWithShippingDiscounts: discounts.combinesWithShippingDiscounts,
      customerMobileEnabled: discounts.customerMobileEnabled,
      deliveryEnabled: discounts.deliveryEnabled,
      buyRequirementType: discounts.buyRequirementType,
      buyRequirementValue: discounts.buyRequirementValue,
      getQuantity: discounts.getQuantity,
      maxUsesPerOrder: discounts.maxUsesPerOrder,
      countryScope: discounts.countryScope,
      countryCodes: discounts.countryCodes,
      maximumShippingPrice: discounts.maximumShippingPrice,
      tags: discounts.tags,
      createdAt: discounts.createdAt,
      createdBy: discounts.createdBy,
      updatedBy: discounts.updatedBy,
    })
    .from(discounts)
    .where(
      and(
        eq(discounts.tenantId, scope.tenantId),
        eq(discounts.id, discountId),
        isNull(discounts.deletedAt),
        visibility,
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const targetRows = await db
    .select({
      role: discountTargets.role,
      targetType: discountTargets.targetType,
      productId: discountTargets.productId,
      productCategoryId: discountTargets.productCategoryId,
      serviceId: discountTargets.serviceId,
      serviceCategoryId: discountTargets.serviceCategoryId,
    })
    .from(discountTargets)
    .where(
      and(
        eq(discountTargets.tenantId, scope.tenantId),
        eq(discountTargets.discountId, discountId),
      ),
    )
    .orderBy(
      asc(discountTargets.role),
      asc(discountTargets.targetType),
      asc(discountTargets.id),
    );
  const customerRows = await db
    .select({ customerId: discountCustomers.customerId })
    .from(discountCustomers)
    .where(
      and(
        eq(discountCustomers.tenantId, scope.tenantId),
        eq(discountCustomers.discountId, discountId),
      ),
    )
    .orderBy(asc(discountCustomers.customerId));

  const targets: DiscountTargetInput[] = targetRows.map((target) => ({
    role: target.role,
    targetType: target.targetType,
    targetId:
      target.productId ??
      target.productCategoryId ??
      target.serviceId ??
      target.serviceCategoryId!,
  }));

  return {
    ...toSummary(row as unknown as SummaryRow),
    tenantId: row.tenantId,
    eligibility: row.eligibility,
    minimumRequirement: row.minimumRequirement,
    minimumPurchaseAmount: row.minimumPurchaseAmount,
    minimumQuantity: row.minimumQuantity,
    combinesWithItemDiscounts: row.combinesWithItemDiscounts,
    combinesWithOrderDiscounts: row.combinesWithOrderDiscounts,
    combinesWithShippingDiscounts: row.combinesWithShippingDiscounts,
    customerMobileEnabled: row.customerMobileEnabled,
    deliveryEnabled: row.deliveryEnabled,
    buyRequirementType: row.buyRequirementType,
    buyRequirementValue: row.buyRequirementValue,
    getQuantity: row.getQuantity,
    maxUsesPerOrder: row.maxUsesPerOrder,
    countryScope: row.countryScope,
    countryCodes: row.countryCodes,
    maximumShippingPrice: row.maximumShippingPrice,
    tags: row.tags,
    branchIds: row.scopeBranchIds,
    targets,
    customerIds: customerRows.map((customer) => customer.customerId),
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
  };
}

export async function findDiscountOverview(
  db: Database,
  scope: DiscountRepositoryScope,
  now = new Date(),
): Promise<DiscountOverview> {
  const visibility = buildVisibilityCondition(scope);
  const filters = and(
    eq(discounts.tenantId, scope.tenantId),
    isNull(discounts.deletedAt),
    visibility,
  );
  const status = derivedStatusExpression(now);
  const applicationBranchFilter =
    scope.allowedBranchIds === undefined
      ? undefined
      : scope.allowedBranchIds.length === 0
        ? sql`false`
        : inArray(orderDiscountApplications.branchId, scope.allowedBranchIds);
  const [countRows, savingsRows] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${status} = 'active')::int`,
        scheduled: sql<number>`count(*) filter (where ${status} = 'scheduled')::int`,
        expired: sql<number>`count(*) filter (where ${status} = 'expired')::int`,
        inactive: sql<number>`count(*) filter (where ${status} = 'inactive')::int`,
        codeDiscounts: sql<number>`count(*) filter (where ${discounts.method} = 'code')::int`,
        automaticDiscounts: sql<number>`count(*) filter (where ${discounts.method} = 'automatic')::int`,
      })
      .from(discounts)
      .where(filters),
    db
      .select({
        currency: orderDiscountApplications.currency,
        amount: sql<string>`coalesce(sum(${orderDiscountApplications.amount}), 0)::text`,
        uses: sql<number>`count(*)::int`,
      })
      .from(orderDiscountApplications)
      .innerJoin(
        discounts,
        and(
          eq(discounts.id, orderDiscountApplications.discountId),
          eq(discounts.tenantId, orderDiscountApplications.tenantId),
        ),
      )
      .innerJoin(
        orders,
        and(
          eq(orders.id, orderDiscountApplications.orderId),
          eq(orders.tenantId, orderDiscountApplications.tenantId),
        ),
      )
      .where(
        and(
          filters,
          eq(orderDiscountApplications.status, "applied"),
          inArray(orders.status, ["paid", "delivered"]),
          eq(orders.paymentStatus, "paid"),
          isNull(orders.deletedAt),
          applicationBranchFilter,
        ),
      )
      .groupBy(orderDiscountApplications.currency)
      .orderBy(asc(orderDiscountApplications.currency)),
  ]);
  const counts = countRows[0];

  return {
    total: counts?.total ?? 0,
    active: counts?.active ?? 0,
    scheduled: counts?.scheduled ?? 0,
    expired: counts?.expired ?? 0,
    inactive: counts?.inactive ?? 0,
    codeDiscounts: counts?.codeDiscounts ?? 0,
    automaticDiscounts: counts?.automaticDiscounts ?? 0,
    totalUses: savingsRows.reduce((total, row) => total + row.uses, 0),
    savingsByCurrency: savingsRows.map((row) => ({
      currency: row.currency,
      amount: Number(row.amount).toFixed(2),
    })),
  };
}

export async function findActiveBranchIds(
  db: Database,
  scope: DiscountRepositoryScope,
): Promise<string[]> {
  const filters: SQL[] = [
    eq(branches.tenantId, scope.tenantId),
    eq(branches.status, "active"),
    isNull(branches.deletedAt),
  ];
  if (scope.allowedBranchIds !== undefined) {
    if (scope.allowedBranchIds.length === 0) return [];
    filters.push(inArray(branches.id, scope.allowedBranchIds));
  }

  const rows = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(...filters));
  return rows.map((row) => row.id);
}

export async function findDiscountListOptions(
  db: Database,
  scope: DiscountRepositoryScope,
): Promise<Pick<DiscountOptions, "branches">> {
  const filters: SQL[] = [
    eq(branches.tenantId, scope.tenantId),
    eq(branches.status, "active"),
    isNull(branches.deletedAt),
  ];
  if (scope.allowedBranchIds !== undefined) {
    filters.push(
      scope.allowedBranchIds.length === 0
        ? sql`false`
        : inArray(branches.id, scope.allowedBranchIds),
    );
  }

  return {
    branches: await db
      .select({
        id: branches.id,
        name: branches.name,
        currency: branches.defaultCurrency,
      })
      .from(branches)
      .where(and(...filters))
      .orderBy(asc(branches.name), asc(branches.id)),
  };
}

export async function findDiscountOptions(
  db: Database,
  scope: DiscountRepositoryScope,
): Promise<Omit<DiscountOptions, "canManage" | "canManageAllBranches">> {
  const branchFilters: SQL[] = [
    eq(branches.tenantId, scope.tenantId),
    eq(branches.status, "active"),
    isNull(branches.deletedAt),
  ];
  if (scope.allowedBranchIds !== undefined) {
    branchFilters.push(
      scope.allowedBranchIds.length === 0
        ? sql`false`
        : inArray(branches.id, scope.allowedBranchIds),
    );
  }

  const productFilters: SQL[] = [
    eq(products.tenantId, scope.tenantId),
    eq(products.status, "active"),
    isNull(products.deletedAt),
  ];
  if (scope.allowedBranchIds !== undefined) {
    productFilters.push(
      scope.allowedBranchIds.length === 0
        ? sql`false`
        : exists(
            db
              .select({ one: sql`1` })
              .from(branchProductSettings)
              .innerJoin(
                productSkus,
                and(
                  eq(productSkus.id, branchProductSettings.productSkuId),
                  eq(productSkus.tenantId, branchProductSettings.tenantId),
                ),
              )
              .where(
                and(
                  eq(branchProductSettings.tenantId, products.tenantId),
                  eq(productSkus.productId, products.id),
                  isNull(productSkus.deletedAt),
                  eq(branchProductSettings.isAvailable, true),
                  inArray(
                    branchProductSettings.branchId,
                    scope.allowedBranchIds,
                  ),
                ),
              ),
          ),
    );
  }

  const [
    branchRows,
    productRows,
    productCategoryRows,
    serviceRows,
    serviceCategoryRows,
    customerRows,
    settingsRows,
  ] = await Promise.all([
    db
      .select({
        id: branches.id,
        name: branches.name,
        currency: branches.defaultCurrency,
      })
      .from(branches)
      .where(and(...branchFilters))
      .orderBy(asc(branches.name), asc(branches.id)),
    db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(and(...productFilters))
      .orderBy(asc(products.name), asc(products.id)),
    db
      .select({ id: productCategories.id, name: productCategories.name })
      .from(productCategories)
      .where(
        and(
          eq(productCategories.tenantId, scope.tenantId),
          eq(productCategories.status, "active"),
          isNull(productCategories.deletedAt),
        ),
      )
      .orderBy(asc(productCategories.name), asc(productCategories.id)),
    db
      .select({
        id: services.id,
        name: services.name,
        categoryId: services.categoryId,
        categoryName: serviceCategories.name,
        businessLine: services.businessLine,
      })
      .from(services)
      .innerJoin(
        serviceCategories,
        and(
          eq(serviceCategories.id, services.categoryId),
          eq(serviceCategories.tenantId, services.tenantId),
        ),
      )
      .where(
        and(
          eq(services.tenantId, scope.tenantId),
          eq(services.status, "active"),
          isNull(services.deletedAt),
          isNull(serviceCategories.deletedAt),
        ),
      )
      .orderBy(asc(services.name), asc(services.id)),
    db
      .select({
        id: serviceCategories.id,
        name: serviceCategories.name,
        businessLine: serviceCategories.businessLine,
      })
      .from(serviceCategories)
      .where(
        and(
          eq(serviceCategories.tenantId, scope.tenantId),
          eq(serviceCategories.status, "active"),
          isNull(serviceCategories.deletedAt),
        ),
      )
      .orderBy(asc(serviceCategories.name), asc(serviceCategories.id)),
    db
      .select({
        id: customers.id,
        fullName: customers.fullName,
        phone: customers.phone,
        email: customers.email,
      })
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, scope.tenantId),
          eq(customers.status, "active"),
          isNull(customers.deletedAt),
        ),
      )
      .orderBy(asc(customers.fullName), asc(customers.id)),
    db
      .select({
        currency: tenantSettings.defaultCurrency,
        timezone: tenantSettings.timezone,
      })
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, scope.tenantId))
      .limit(1),
  ]);
  const settings = settingsRows[0];
  const defaultCurrency = settings?.currency ?? "XOF";
  const currencies = [
    ...new Set([
      defaultCurrency,
      ...branchRows.map((branch) => branch.currency),
    ]),
  ].sort((left, right) => {
    if (left === defaultCurrency) return -1;
    if (right === defaultCurrency) return 1;
    return left.localeCompare(right);
  });

  return {
    defaultCurrency,
    branches: branchRows,
    products: productRows,
    productCategories: productCategoryRows,
    services: serviceRows,
    serviceCategories: serviceCategoryRows,
    customers: customerRows,
    currencies,
    timezone: settings?.timezone ?? "UTC",
  };
}

export async function findDiscountReferenceValidation(
  db: Database,
  tenantId: string,
  input: Pick<CreateDiscountRequest, "branchIds" | "targets" | "customerIds">,
): Promise<DiscountReferenceValidation> {
  const byType = (targetType: DiscountTargetInput["targetType"]) =>
    input.targets
      .filter((target) => target.targetType === targetType)
      .map((target) => target.targetId);
  const productIds = [...new Set(byType("product"))];
  const productCategoryIds = [...new Set(byType("product_category"))];
  const serviceIds = [...new Set(byType("service"))];
  const serviceCategoryIds = [...new Set(byType("service_category"))];

  const [
    branchRows,
    productRows,
    productCategoryRows,
    serviceRows,
    serviceCategoryRows,
    customerRows,
  ] = await Promise.all([
    input.branchIds.length === 0
      ? []
      : db
          .select({ id: branches.id })
          .from(branches)
          .where(
            and(
              eq(branches.tenantId, tenantId),
              inArray(branches.id, input.branchIds),
              eq(branches.status, "active"),
              isNull(branches.deletedAt),
            ),
          ),
    productIds.length === 0
      ? []
      : db
          .select({ id: products.id })
          .from(products)
          .where(
            and(
              eq(products.tenantId, tenantId),
              inArray(products.id, productIds),
              isNull(products.deletedAt),
            ),
          ),
    productCategoryIds.length === 0
      ? []
      : db
          .select({ id: productCategories.id })
          .from(productCategories)
          .where(
            and(
              eq(productCategories.tenantId, tenantId),
              inArray(productCategories.id, productCategoryIds),
              isNull(productCategories.deletedAt),
            ),
          ),
    serviceIds.length === 0
      ? []
      : db
          .select({ id: services.id })
          .from(services)
          .where(
            and(
              eq(services.tenantId, tenantId),
              inArray(services.id, serviceIds),
              isNull(services.deletedAt),
            ),
          ),
    serviceCategoryIds.length === 0
      ? []
      : db
          .select({ id: serviceCategories.id })
          .from(serviceCategories)
          .where(
            and(
              eq(serviceCategories.tenantId, tenantId),
              inArray(serviceCategories.id, serviceCategoryIds),
              isNull(serviceCategories.deletedAt),
            ),
          ),
    input.customerIds.length === 0
      ? []
      : db
          .select({ id: customers.id })
          .from(customers)
          .where(
            and(
              eq(customers.tenantId, tenantId),
              inArray(customers.id, input.customerIds),
              isNull(customers.deletedAt),
            ),
          ),
  ]);

  return {
    branchIds: new Set(branchRows.map((row) => row.id)),
    productIds: new Set(productRows.map((row) => row.id)),
    productCategoryIds: new Set(productCategoryRows.map((row) => row.id)),
    serviceIds: new Set(serviceRows.map((row) => row.id)),
    serviceCategoryIds: new Set(serviceCategoryRows.map((row) => row.id)),
    customerIds: new Set(customerRows.map((row) => row.id)),
  };
}

export async function findDiscountCodeOwner(
  db: Database,
  input: { tenantId: string; code: string; excludeDiscountId?: string },
): Promise<{ discountId: string } | null> {
  const rows = await db
    .select({ discountId: discountCodes.discountId })
    .from(discountCodes)
    .where(
      and(
        eq(discountCodes.tenantId, input.tenantId),
        sql`lower(${discountCodes.code}) = lower(${input.code.trim()})`,
        isNull(discountCodes.deletedAt),
        input.excludeDiscountId
          ? sql`${discountCodes.discountId} <> ${input.excludeDiscountId}`
          : undefined,
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

function discountInsertValues(
  input: CreateDiscountRequest & {
    tenantId: string;
    actorUserId: string;
  },
) {
  return {
    tenantId: input.tenantId,
    title: input.title.trim(),
    method: input.method,
    type: input.type,
    enabled: input.enabled,
    valueType: input.valueType,
    valueAmount: input.valueAmount,
    currency: input.currency,
    eligibility: input.eligibility,
    minimumRequirement: input.minimumRequirement,
    minimumPurchaseAmount: input.minimumPurchaseAmount,
    minimumQuantity: input.minimumQuantity,
    usageLimit: input.usageLimit,
    oncePerCustomer: input.oncePerCustomer,
    combinesWithItemDiscounts: input.combinesWithItemDiscounts,
    combinesWithOrderDiscounts: input.combinesWithOrderDiscounts,
    combinesWithShippingDiscounts: input.combinesWithShippingDiscounts,
    startsAt: new Date(input.startsAt),
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    allBranches: input.allBranches,
    posEnabled: input.channels.posEnabled,
    customerMobileEnabled: input.channels.customerMobileEnabled,
    deliveryEnabled: input.channels.deliveryEnabled,
    buyRequirementType: input.buyRequirementType,
    buyRequirementValue: input.buyRequirementValue,
    getQuantity: input.getQuantity,
    maxUsesPerOrder: input.maxUsesPerOrder,
    countryScope: input.countryScope,
    countryCodes: input.countryCodes,
    maximumShippingPrice: input.maximumShippingPrice,
    tags: input.tags,
    createdBy: input.actorUserId,
    updatedBy: input.actorUserId,
  };
}

async function replaceDiscountRelations(
  db: Database,
  input: CreateDiscountRequest & {
    tenantId: string;
    discountId: string;
    actorUserId: string;
  },
): Promise<void> {
  const existingCodeRows = await db
    .select({ id: discountCodes.id, code: discountCodes.code })
    .from(discountCodes)
    .where(
      and(
        eq(discountCodes.tenantId, input.tenantId),
        eq(discountCodes.discountId, input.discountId),
        isNull(discountCodes.deletedAt),
      ),
    )
    .limit(1);
  const existingCode = existingCodeRows[0];
  const keepExistingCode =
    input.method === "code" &&
    input.code !== null &&
    existingCode?.code.toLocaleLowerCase() === input.code.toLocaleLowerCase();

  if (existingCode && !keepExistingCode) {
    await db
      .update(discountCodes)
      .set({
        deletedAt: new Date(),
        deletedBy: input.actorUserId,
      })
      .where(eq(discountCodes.id, existingCode.id));
  }
  if (input.method === "code" && input.code && !keepExistingCode) {
    await db.insert(discountCodes).values({
      id: createId(),
      tenantId: input.tenantId,
      discountId: input.discountId,
      code: input.code,
      createdBy: input.actorUserId,
    });
  }

  await db
    .delete(discountBranches)
    .where(
      and(
        eq(discountBranches.tenantId, input.tenantId),
        eq(discountBranches.discountId, input.discountId),
      ),
    );
  await db
    .delete(discountTargets)
    .where(
      and(
        eq(discountTargets.tenantId, input.tenantId),
        eq(discountTargets.discountId, input.discountId),
      ),
    );
  await db
    .delete(discountCustomers)
    .where(
      and(
        eq(discountCustomers.tenantId, input.tenantId),
        eq(discountCustomers.discountId, input.discountId),
      ),
    );

  if (input.branchIds.length > 0) {
    await db.insert(discountBranches).values(
      input.branchIds.map((branchId) => ({
        id: createId(),
        tenantId: input.tenantId,
        discountId: input.discountId,
        branchId,
        createdBy: input.actorUserId,
      })),
    );
  }
  if (input.targets.length > 0) {
    await db.insert(discountTargets).values(
      input.targets.map((target) => ({
        id: createId(),
        tenantId: input.tenantId,
        discountId: input.discountId,
        role: target.role,
        targetType: target.targetType,
        productId: target.targetType === "product" ? target.targetId : null,
        productCategoryId:
          target.targetType === "product_category" ? target.targetId : null,
        serviceId: target.targetType === "service" ? target.targetId : null,
        serviceCategoryId:
          target.targetType === "service_category" ? target.targetId : null,
        createdBy: input.actorUserId,
      })),
    );
  }
  if (input.customerIds.length > 0) {
    await db.insert(discountCustomers).values(
      input.customerIds.map((customerId) => ({
        id: createId(),
        tenantId: input.tenantId,
        discountId: input.discountId,
        customerId,
        createdBy: input.actorUserId,
      })),
    );
  }
}

export async function createDiscountRecord(
  db: Database,
  input: CreateDiscountRequest & {
    tenantId: string;
    actorUserId: string;
  },
): Promise<string> {
  const discountId = createId();
  await db.insert(discounts).values({
    id: discountId,
    ...discountInsertValues(input),
  });
  await replaceDiscountRelations(db, { ...input, discountId });
  return discountId;
}

export async function updateDiscountRecord(
  db: Database,
  input: CreateDiscountRequest & {
    tenantId: string;
    discountId: string;
    actorUserId: string;
    version: number;
  },
): Promise<boolean> {
  const values = discountInsertValues(input);
  const rows = await db
    .update(discounts)
    .set({
      ...values,
      createdBy: undefined,
      updatedAt: new Date(),
      version: sql`${discounts.version} + 1`,
    })
    .where(
      and(
        eq(discounts.tenantId, input.tenantId),
        eq(discounts.id, input.discountId),
        eq(discounts.version, input.version),
        isNull(discounts.deletedAt),
      ),
    )
    .returning({ id: discounts.id });
  if (!rows[0]) return false;

  await replaceDiscountRelations(db, input);
  return true;
}

export async function updateDiscountEnabledRecord(
  db: Database,
  input: {
    tenantId: string;
    discountId: string;
    enabled: boolean;
    version: number;
    actorUserId: string;
  },
): Promise<boolean> {
  const rows = await db
    .update(discounts)
    .set({
      enabled: input.enabled,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${discounts.version} + 1`,
    })
    .where(
      and(
        eq(discounts.tenantId, input.tenantId),
        eq(discounts.id, input.discountId),
        eq(discounts.version, input.version),
        isNull(discounts.deletedAt),
      ),
    )
    .returning({ id: discounts.id });
  return Boolean(rows[0]);
}

export async function softDeleteDiscountRecord(
  db: Database,
  input: {
    tenantId: string;
    discountId: string;
    version: number;
    actorUserId: string;
  },
): Promise<boolean> {
  const now = new Date();
  const rows = await db
    .update(discounts)
    .set({
      deletedAt: now,
      deletedBy: input.actorUserId,
      enabled: false,
      updatedAt: now,
      updatedBy: input.actorUserId,
      version: sql`${discounts.version} + 1`,
    })
    .where(
      and(
        eq(discounts.tenantId, input.tenantId),
        eq(discounts.id, input.discountId),
        eq(discounts.version, input.version),
        isNull(discounts.deletedAt),
      ),
    )
    .returning({ id: discounts.id });
  if (!rows[0]) return false;

  await db
    .update(discountCodes)
    .set({ deletedAt: now, deletedBy: input.actorUserId })
    .where(
      and(
        eq(discountCodes.tenantId, input.tenantId),
        eq(discountCodes.discountId, input.discountId),
        isNull(discountCodes.deletedAt),
      ),
    );
  return true;
}
