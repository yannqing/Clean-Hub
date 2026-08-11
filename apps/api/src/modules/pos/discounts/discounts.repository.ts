import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  discountBranches,
  discountCodes,
  discountCustomers,
  discounts as discountDefinitions,
  discountTargets,
  orderDiscountAllocations,
  orderDiscountApplications,
  orderDiscountIdempotencyReceipts,
  orderItems,
  orders,
  products,
  productSkus,
  services,
  type Database,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import { projectPosOrderPaymentState } from "../orders/order-payment-state.js";
import { minorToMoney, moneyToMinor } from "./pricing-engine.js";
import type {
  PosDiscountApplicationRecord,
  PosDiscountIdempotencyReceiptRecord,
  PosDiscountOrderRecord,
  PosDiscountPricingAllocation,
  PosDiscountPricingLine,
  PosDiscountRule,
  PosDiscountTarget,
  PosOrderDiscountApplication,
} from "./discounts.types.js";

type FindDiscountRulesInput = {
  tenantId: string;
  branchId: string;
  customerId: string | null;
  orderId: string;
  now: Date;
  method?: "code" | "automatic";
  code?: string;
  discountIds?: string[];
};

function targetId(target: typeof discountTargets.$inferSelect): string | null {
  switch (target.targetType) {
    case "product":
      return target.productId;
    case "product_category":
      return target.productCategoryId;
    case "service":
      return target.serviceId;
    case "service_category":
      return target.serviceCategoryId;
  }
}

function toApplicationRecord(
  row: typeof orderDiscountApplications.$inferSelect,
): PosDiscountApplicationRecord {
  return {
    id: row.id,
    orderId: row.orderId,
    discountId: row.discountId,
    discountCodeId: row.discountCodeId,
    codeSnapshot: row.codeSnapshot,
    method: row.methodSnapshot,
    type: row.typeSnapshot,
    amount: row.amount,
    idempotencyKey: row.idempotencyKey,
    status: row.status,
    appliedAt: row.appliedAt,
  };
}

export async function findPosDiscountRules(
  db: Database,
  input: FindDiscountRulesInput,
): Promise<PosDiscountRule[]> {
  if (input.discountIds?.length === 0) {
    return [];
  }

  const filters: SQL[] = [
    eq(discountDefinitions.tenantId, input.tenantId),
    eq(discountDefinitions.enabled, true),
    eq(discountDefinitions.posEnabled, true),
    isNull(discountDefinitions.deletedAt),
    lte(discountDefinitions.startsAt, input.now),
    or(
      isNull(discountDefinitions.endsAt),
      sql`${discountDefinitions.endsAt} > ${input.now}`,
    )!,
  ];
  if (input.method) {
    filters.push(eq(discountDefinitions.method, input.method));
  }
  if (input.discountIds) {
    filters.push(inArray(discountDefinitions.id, input.discountIds));
  }
  if (input.code) {
    filters.push(
      sql`lower(${discountCodes.code}) = lower(${input.code.trim()})`,
    );
  }

  const rows = await db
    .select({
      discount: discountDefinitions,
      codeId: discountCodes.id,
      code: discountCodes.code,
    })
    .from(discountDefinitions)
    .leftJoin(
      discountCodes,
      and(
        eq(discountCodes.tenantId, discountDefinitions.tenantId),
        eq(discountCodes.discountId, discountDefinitions.id),
        isNull(discountCodes.deletedAt),
      ),
    )
    .where(and(...filters))
    .orderBy(asc(discountDefinitions.createdAt), asc(discountDefinitions.id));
  if (rows.length === 0) {
    return [];
  }

  const ids = rows.map((row) => row.discount.id);
  // Keep these sequential: callers frequently pass a transaction-bound
  // client, and node-postgres does not support concurrent queries on one
  // transaction connection.
  const branchRows = await db
    .select({
      discountId: discountBranches.discountId,
      branchId: discountBranches.branchId,
    })
    .from(discountBranches)
    .where(
      and(
        eq(discountBranches.tenantId, input.tenantId),
        inArray(discountBranches.discountId, ids),
      ),
    );
  const customerRows = await db
    .select({
      discountId: discountCustomers.discountId,
      customerId: discountCustomers.customerId,
    })
    .from(discountCustomers)
    .where(
      and(
        eq(discountCustomers.tenantId, input.tenantId),
        inArray(discountCustomers.discountId, ids),
      ),
    );
  const targetRows = await db
    .select()
    .from(discountTargets)
    .where(
      and(
        eq(discountTargets.tenantId, input.tenantId),
        inArray(discountTargets.discountId, ids),
      ),
    );
  const usageRows = await db
    .select({
      discountId: orderDiscountApplications.discountId,
      count: sql<number>`count(*)::int`,
    })
    .from(orderDiscountApplications)
    .innerJoin(
      orders,
      and(
        eq(orders.tenantId, orderDiscountApplications.tenantId),
        eq(orders.id, orderDiscountApplications.orderId),
      ),
    )
    .where(
      and(
        eq(orderDiscountApplications.tenantId, input.tenantId),
        inArray(orderDiscountApplications.discountId, ids),
        eq(orderDiscountApplications.status, "applied"),
        ne(orderDiscountApplications.orderId, input.orderId),
        ne(orders.status, "cancelled"),
        isNull(orders.deletedAt),
      ),
    )
    .groupBy(orderDiscountApplications.discountId);
  const customerUsageRows = input.customerId
    ? await db
        .select({
          discountId: orderDiscountApplications.discountId,
          count: sql<number>`count(*)::int`,
        })
        .from(orderDiscountApplications)
        .innerJoin(
          orders,
          and(
            eq(orders.tenantId, orderDiscountApplications.tenantId),
            eq(orders.id, orderDiscountApplications.orderId),
          ),
        )
        .where(
          and(
            eq(orderDiscountApplications.tenantId, input.tenantId),
            inArray(orderDiscountApplications.discountId, ids),
            eq(orderDiscountApplications.customerId, input.customerId),
            eq(orderDiscountApplications.status, "applied"),
            ne(orderDiscountApplications.orderId, input.orderId),
            ne(orders.status, "cancelled"),
            isNull(orders.deletedAt),
          ),
        )
        .groupBy(orderDiscountApplications.discountId)
    : [];

  const branchIds = new Map<string, Set<string>>();
  for (const row of branchRows) {
    const values = branchIds.get(row.discountId) ?? new Set<string>();
    values.add(row.branchId);
    branchIds.set(row.discountId, values);
  }
  const customerIds = new Map<string, Set<string>>();
  for (const row of customerRows) {
    const values = customerIds.get(row.discountId) ?? new Set<string>();
    values.add(row.customerId);
    customerIds.set(row.discountId, values);
  }
  const targets = new Map<string, PosDiscountTarget[]>();
  for (const row of targetRows) {
    const id = targetId(row);
    if (!id) {
      continue;
    }
    const values = targets.get(row.discountId) ?? [];
    values.push({
      role: row.role,
      targetType: row.targetType,
      targetId: id,
    });
    targets.set(row.discountId, values);
  }
  const usage = new Map(
    usageRows.map((row) => [row.discountId, Number(row.count)]),
  );
  const customerUsage = new Map(
    customerUsageRows.map((row) => [row.discountId, Number(row.count)]),
  );

  return rows.flatMap((row): PosDiscountRule[] => {
    const discount = row.discount;
    if (
      discount.valueType === null ||
      (discount.oncePerCustomer && input.customerId === null) ||
      (!discount.allBranches &&
        !branchIds.get(discount.id)?.has(input.branchId)) ||
      (discount.eligibility === "specific_customers" &&
        (input.customerId === null ||
          !customerIds.get(discount.id)?.has(input.customerId)))
    ) {
      return [];
    }
    return [
      {
        id: discount.id,
        title: discount.title,
        method: discount.method,
        type: discount.type,
        valueType: discount.valueType,
        valueAmount: discount.valueAmount,
        currency: discount.currency,
        minimumRequirement: discount.minimumRequirement,
        minimumPurchaseAmount: discount.minimumPurchaseAmount,
        minimumQuantity: discount.minimumQuantity,
        usageLimit: discount.usageLimit,
        oncePerCustomer: discount.oncePerCustomer,
        combinesWithItemDiscounts: discount.combinesWithItemDiscounts,
        combinesWithOrderDiscounts: discount.combinesWithOrderDiscounts,
        combinesWithShippingDiscounts: discount.combinesWithShippingDiscounts,
        buyRequirementType: discount.buyRequirementType,
        buyRequirementValue: discount.buyRequirementValue,
        getQuantity: discount.getQuantity,
        maxUsesPerOrder: discount.maxUsesPerOrder,
        countryScope: discount.countryScope,
        maximumShippingPrice: discount.maximumShippingPrice,
        codeId: row.codeId,
        code: row.code,
        targets: targets.get(discount.id) ?? [],
        usageCount: usage.get(discount.id) ?? 0,
        customerUsageCount: customerUsage.get(discount.id) ?? 0,
      },
    ];
  });
}

export async function lockPosDiscountRules(
  db: Database,
  input: { tenantId: string; discountIds: string[] },
): Promise<void> {
  if (input.discountIds.length === 0) {
    return;
  }
  await db
    .select({ id: discountDefinitions.id })
    .from(discountDefinitions)
    .where(
      and(
        eq(discountDefinitions.tenantId, input.tenantId),
        inArray(discountDefinitions.id, input.discountIds),
      ),
    )
    .orderBy(asc(discountDefinitions.id))
    .for("update");
}

export async function lockPosDiscountIdempotencyKey(
  db: Database,
  input: { tenantId: string; idempotencyKey: string },
): Promise<void> {
  await db.execute(
    sql`select pg_advisory_xact_lock(
      hashtextextended(${input.tenantId} || ':' || ${input.idempotencyKey}, 0)
    )`,
  );
}

export async function findPosDiscountOrderLines(
  db: Database,
  input: { tenantId: string; orderId: string },
): Promise<PosDiscountPricingLine[]> {
  const rows = await db
    .select({
      id: orderItems.id,
      itemKind: orderItems.itemKind,
      lineAmount: orderItems.lineAmount,
      quantity: orderItems.quantity,
      weight: orderItems.weight,
      pricingUnit: orderItems.pricingUnit,
      serviceId: orderItems.serviceId,
      serviceCategoryId: services.categoryId,
      productId: productSkus.productId,
      productCategoryId: products.categoryId,
    })
    .from(orderItems)
    .leftJoin(
      services,
      and(
        eq(services.tenantId, orderItems.tenantId),
        eq(services.id, orderItems.serviceId),
      ),
    )
    .leftJoin(
      productSkus,
      and(
        eq(productSkus.tenantId, orderItems.tenantId),
        eq(productSkus.id, orderItems.productSkuId),
      ),
    )
    .leftJoin(
      products,
      and(
        eq(products.tenantId, productSkus.tenantId),
        eq(products.id, productSkus.productId),
      ),
    )
    .where(
      and(
        eq(orderItems.tenantId, input.tenantId),
        eq(orderItems.orderId, input.orderId),
        isNull(orderItems.deletedAt),
      ),
    )
    .orderBy(asc(orderItems.createdAt), asc(orderItems.id));

  return rows;
}

export async function listActivePosDiscountApplicationRecords(
  db: Database,
  input: { tenantId: string; orderId: string },
): Promise<PosDiscountApplicationRecord[]> {
  const rows = await db
    .select()
    .from(orderDiscountApplications)
    .where(
      and(
        eq(orderDiscountApplications.tenantId, input.tenantId),
        eq(orderDiscountApplications.orderId, input.orderId),
        eq(orderDiscountApplications.status, "applied"),
      ),
    )
    .orderBy(
      asc(orderDiscountApplications.appliedAt),
      asc(orderDiscountApplications.id),
    );
  return rows.map(toApplicationRecord);
}

export async function listPosOrderDiscountApplications(
  db: Database,
  input: { tenantId: string; orderId: string },
): Promise<PosOrderDiscountApplication[]> {
  const applications = await db
    .select()
    .from(orderDiscountApplications)
    .where(
      and(
        eq(orderDiscountApplications.tenantId, input.tenantId),
        eq(orderDiscountApplications.orderId, input.orderId),
        eq(orderDiscountApplications.status, "applied"),
      ),
    )
    .orderBy(
      asc(orderDiscountApplications.appliedAt),
      asc(orderDiscountApplications.id),
    );
  if (applications.length === 0) {
    return [];
  }
  const applicationIds = applications.map((row) => row.id);
  const allocationRows = await db
    .select()
    .from(orderDiscountAllocations)
    .where(
      and(
        eq(orderDiscountAllocations.tenantId, input.tenantId),
        inArray(orderDiscountAllocations.applicationId, applicationIds),
      ),
    )
    .orderBy(
      asc(orderDiscountAllocations.applicationId),
      asc(orderDiscountAllocations.orderItemId),
    );
  const allocations = new Map<
    string,
    PosOrderDiscountApplication["allocations"]
  >();
  for (const row of allocationRows) {
    const values = allocations.get(row.applicationId) ?? [];
    values.push({
      id: row.id,
      orderItemId: row.orderItemId,
      amount: row.amount,
    });
    allocations.set(row.applicationId, values);
  }

  return applications.map((row) => ({
    id: row.id,
    discountId: row.discountId,
    discountCodeId: row.discountCodeId,
    title: row.titleSnapshot,
    code: row.codeSnapshot,
    method: row.methodSnapshot,
    type: row.typeSnapshot,
    valueType: row.valueTypeSnapshot,
    valueAmount: row.valueAmountSnapshot,
    amount: row.amount,
    currency: row.currency,
    appliedAt: row.appliedAt.toISOString(),
    allocations: allocations.get(row.id) ?? [],
  }));
}

export async function findPosDiscountApplicationByIdempotencyKey(
  db: Database,
  input: { tenantId: string; idempotencyKey: string },
): Promise<PosDiscountApplicationRecord | null> {
  const rows = await db
    .select()
    .from(orderDiscountApplications)
    .where(
      and(
        eq(orderDiscountApplications.tenantId, input.tenantId),
        eq(orderDiscountApplications.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  return rows[0] ? toApplicationRecord(rows[0]) : null;
}

export async function findPosDiscountIdempotencyReceipt(
  db: Database,
  input: { tenantId: string; idempotencyKey: string },
): Promise<PosDiscountIdempotencyReceiptRecord | null> {
  const rows = await db
    .select({
      application: orderDiscountApplications,
      intentKind: orderDiscountIdempotencyReceipts.intentKind,
      intentValue: orderDiscountIdempotencyReceipts.intentValue,
      reasonSnapshot: orderDiscountIdempotencyReceipts.reasonSnapshot,
    })
    .from(orderDiscountIdempotencyReceipts)
    .innerJoin(
      orderDiscountApplications,
      and(
        eq(
          orderDiscountApplications.tenantId,
          orderDiscountIdempotencyReceipts.tenantId,
        ),
        eq(
          orderDiscountApplications.id,
          orderDiscountIdempotencyReceipts.applicationId,
        ),
      ),
    )
    .where(
      and(
        eq(orderDiscountIdempotencyReceipts.tenantId, input.tenantId),
        eq(
          orderDiscountIdempotencyReceipts.idempotencyKey,
          input.idempotencyKey,
        ),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    application: toApplicationRecord(row.application),
    intentKind: row.intentKind as "code" | "discount_id",
    intentValue: row.intentValue,
    reasonSnapshot: row.reasonSnapshot,
  };
}

export async function createPosDiscountIdempotencyReceipt(
  db: Database,
  input: {
    tenantId: string;
    applicationId: string;
    idempotencyKey: string;
    intentKind: "code" | "discount_id";
    intentValue: string;
    reason: string;
    actorUserId: string;
  },
): Promise<void> {
  await db.insert(orderDiscountIdempotencyReceipts).values({
    id: createId(),
    tenantId: input.tenantId,
    applicationId: input.applicationId,
    idempotencyKey: input.idempotencyKey,
    intentKind: input.intentKind,
    intentValue: input.intentValue,
    reasonSnapshot: input.reason,
    createdBy: input.actorUserId,
  });
}

export async function findActivePosDiscountApplication(
  db: Database,
  input: { tenantId: string; orderId: string; applicationId: string },
): Promise<PosDiscountApplicationRecord | null> {
  const rows = await db
    .select()
    .from(orderDiscountApplications)
    .where(
      and(
        eq(orderDiscountApplications.id, input.applicationId),
        eq(orderDiscountApplications.tenantId, input.tenantId),
        eq(orderDiscountApplications.orderId, input.orderId),
        eq(orderDiscountApplications.status, "applied"),
      ),
    )
    .limit(1);
  return rows[0] ? toApplicationRecord(rows[0]) : null;
}

export async function createPosDiscountApplicationRecord(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    customerId: string | null;
    orderId: string;
    rule: PosDiscountRule;
    amountMinor: bigint;
    currency: string;
    idempotencyKey?: string;
    actorUserId: string;
  },
): Promise<string> {
  const id = createId();
  await db.insert(orderDiscountApplications).values({
    id,
    tenantId: input.tenantId,
    branchId: input.branchId,
    customerId: input.customerId,
    orderId: input.orderId,
    discountId: input.rule.id,
    discountCodeId: input.rule.codeId,
    titleSnapshot: input.rule.title,
    codeSnapshot: input.rule.code,
    methodSnapshot: input.rule.method,
    typeSnapshot: input.rule.type,
    valueTypeSnapshot: input.rule.valueType,
    valueAmountSnapshot: input.rule.valueAmount,
    amount: minorToMoney(input.amountMinor),
    currency: input.currency,
    idempotencyKey: input.idempotencyKey,
    createdBy: input.actorUserId,
  });
  return id;
}

export async function updatePosDiscountApplicationRecord(
  db: Database,
  input: {
    tenantId: string;
    applicationId: string;
    rule: PosDiscountRule;
    amountMinor: bigint;
  },
): Promise<void> {
  await db
    .update(orderDiscountApplications)
    .set({
      discountCodeId: input.rule.codeId,
      titleSnapshot: input.rule.title,
      codeSnapshot: input.rule.code,
      methodSnapshot: input.rule.method,
      typeSnapshot: input.rule.type,
      valueTypeSnapshot: input.rule.valueType,
      valueAmountSnapshot: input.rule.valueAmount,
      amount: minorToMoney(input.amountMinor),
    })
    .where(
      and(
        eq(orderDiscountApplications.id, input.applicationId),
        eq(orderDiscountApplications.tenantId, input.tenantId),
        eq(orderDiscountApplications.status, "applied"),
      ),
    );
}

export async function replacePosDiscountAllocations(
  db: Database,
  input: {
    tenantId: string;
    orderId: string;
    applicationId: string;
    allocations: PosDiscountPricingAllocation[];
  },
): Promise<void> {
  await db
    .delete(orderDiscountAllocations)
    .where(
      and(
        eq(orderDiscountAllocations.tenantId, input.tenantId),
        eq(orderDiscountAllocations.applicationId, input.applicationId),
      ),
    );
  if (input.allocations.length === 0) {
    return;
  }
  await db.insert(orderDiscountAllocations).values(
    input.allocations.map((allocation) => ({
      id: createId(),
      tenantId: input.tenantId,
      applicationId: input.applicationId,
      orderId: input.orderId,
      orderItemId: allocation.orderItemId,
      amount: minorToMoney(allocation.amountMinor),
    })),
  );
}

export async function voidPosDiscountApplicationRecord(
  db: Database,
  input: {
    tenantId: string;
    applicationId: string;
    reason: string;
    actorUserId: string;
  },
): Promise<void> {
  await db
    .update(orderDiscountApplications)
    .set({
      status: "voided",
      voidedAt: new Date(),
      voidReason: input.reason,
      voidedBy: input.actorUserId,
    })
    .where(
      and(
        eq(orderDiscountApplications.id, input.applicationId),
        eq(orderDiscountApplications.tenantId, input.tenantId),
        eq(orderDiscountApplications.status, "applied"),
      ),
    );
}

export async function releaseActivePosOrderDiscounts(
  db: Database,
  input: {
    tenantId: string;
    orderId: string;
    actorUserId: string;
    reason: string;
  },
): Promise<
  Array<{ applicationId: string; discountId: string; amount: string }>
> {
  const now = new Date();
  const released = await db
    .update(orderDiscountApplications)
    .set({
      status: "voided",
      voidedAt: now,
      voidReason: input.reason,
      voidedBy: input.actorUserId,
    })
    .where(
      and(
        eq(orderDiscountApplications.tenantId, input.tenantId),
        eq(orderDiscountApplications.orderId, input.orderId),
        eq(orderDiscountApplications.status, "applied"),
      ),
    )
    .returning({
      applicationId: orderDiscountApplications.id,
      discountId: orderDiscountApplications.discountId,
      amount: orderDiscountApplications.amount,
    });

  if (released.length > 0) {
    await db
      .update(orders)
      .set({
        discountAmount: "0",
        totalAmount: sql`${orders.subtotalAmount}`,
        paymentStatus: "unpaid",
        paidAt: null,
        updatedAt: now,
        updatedBy: input.actorUserId,
        version: sql`${orders.version} + 1`,
      })
      .where(
        and(
          eq(orders.id, input.orderId),
          eq(orders.tenantId, input.tenantId),
          isNull(orders.deletedAt),
        ),
      );
  }

  return released;
}

export async function updatePosDiscountOrderTotals(
  db: Database,
  input: {
    order: PosDiscountOrderRecord;
    subtotalMinor: bigint;
    discountMinor: bigint;
    actorUserId: string;
  },
): Promise<number> {
  const discount =
    input.discountMinor > input.subtotalMinor
      ? input.subtotalMinor
      : input.discountMinor;
  const nextTotalAmount = minorToMoney(input.subtotalMinor - discount);
  const payment = projectPosOrderPaymentState({
    current: input.order,
    nextTotalAmount,
    nextPaidAmount: input.order.paidAmount,
    zeroTotalSettlement:
      input.subtotalMinor > BigInt(0) && discount === input.subtotalMinor,
  });
  const now = new Date();
  const rows = await db
    .update(orders)
    .set({
      subtotalAmount: minorToMoney(input.subtotalMinor),
      discountAmount: minorToMoney(discount),
      totalAmount: nextTotalAmount,
      paymentStatus: payment.paymentStatus,
      paidAt: payment.paidAt,
      status: payment.status,
      updatedAt: now,
      updatedBy: input.actorUserId,
      version: sql`${orders.version} + 1`,
    })
    .where(
      and(
        eq(orders.id, input.order.id),
        eq(orders.tenantId, input.order.tenantId),
        eq(orders.version, input.order.version),
        isNull(orders.deletedAt),
      ),
    )
    .returning({ version: orders.version });
  return rows[0]?.version ?? 0;
}

export function subtotalMinorFromLines(
  lines: PosDiscountPricingLine[],
): bigint {
  return lines.reduce(
    (total, line) => total + moneyToMinor(line.lineAmount),
    BigInt(0),
  );
}
