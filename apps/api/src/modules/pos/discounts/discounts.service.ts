import { getDb, type Database } from "@cleanhub/db";

import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import {
  authorizePosSensitiveOperation,
  createPosAuditMetadata,
  requirePosBranchAccess,
  requirePosTenantId,
} from "../access-control.helper.js";
import { PosOrderError } from "../orders/orders.errors.js";
import {
  findPosOrderDetail,
  findPosOrderRawForUpdate,
  findPendingManualPaymentForOrder,
} from "../orders/orders.repository.js";
import type { PosOrderDetail } from "../orders/orders.types.js";
import {
  createPosDiscountIdempotencyReceipt,
  createPosDiscountApplicationRecord,
  findActivePosDiscountApplication,
  findPosDiscountIdempotencyReceipt,
  findPosDiscountOrderLines,
  findPosDiscountRules,
  listActivePosDiscountApplicationRecords,
  lockPosDiscountIdempotencyKey,
  lockPosDiscountRules,
  replacePosDiscountAllocations,
  subtotalMinorFromLines,
  updatePosDiscountApplicationRecord,
  updatePosDiscountOrderTotals,
  voidPosDiscountApplicationRecord,
} from "./discounts.repository.js";
import {
  discountsCanCombine,
  moneyToMinor,
  pricePosDiscount,
} from "./pricing-engine.js";
import type {
  ApplyPosOrderDiscountRequest,
  PosDiscountApplicationRecord,
  PosDiscountIdempotencyReceiptRecord,
  PosDiscountOrderRecord,
  PosDiscountPricingResult,
  PosDiscountPricingLine,
  PosDiscountPreviewSelection,
  PosDiscountRule,
  PosOrderDiscountRequestInput,
  RemovePosOrderDiscountRequest,
} from "./discounts.types.js";

type SelectedDiscount = {
  rule: PosDiscountRule;
  result: PosDiscountPricingResult;
};

function assertDiscountMutable(order: PosDiscountOrderRecord): void {
  if (
    moneyToMinor(order.paidAmount) > BigInt(0) ||
    order.status === "paid" ||
    order.status === "delivered" ||
    order.status === "cancelled"
  ) {
    throw new PosOrderError(
      "ORDER_ALREADY_PAID",
      "Discounts cannot be changed after an order is paid or finalized.",
      422,
    );
  }
}

function assertOrderVersion(
  order: PosDiscountOrderRecord,
  version: number,
): void {
  if (order.version !== version) {
    throw new PosOrderError(
      "VERSION_CONFLICT",
      "Order has been modified. Refresh and try again.",
      409,
    );
  }
}

async function assertNoPendingManualPayment(
  db: Database,
  order: Pick<PosDiscountOrderRecord, "tenantId" | "id">,
): Promise<void> {
  const pendingPayment = await findPendingManualPaymentForOrder(db, {
    tenantId: order.tenantId,
    orderId: order.id,
  });
  if (pendingPayment) {
    throw new PosOrderError(
      "PAYMENT_ALREADY_PENDING",
      "Resolve the pending Wave or Orange Money payment before changing order pricing.",
      409,
    );
  }
}

function applyAllocations(
  remaining: Map<string, bigint>,
  result: PosDiscountPricingResult,
): void {
  for (const allocation of result.allocations) {
    const current = remaining.get(allocation.orderItemId) ?? BigInt(0);
    remaining.set(
      allocation.orderItemId,
      current > allocation.amountMinor
        ? current - allocation.amountMinor
        : BigInt(0),
    );
  }
}

/**
 * Non-mutating cart price preview. Usage counters are deliberately not
 * reserved here; checkout acquires discount locks and recalculates before the
 * order is committed.
 */
export async function previewPosDiscountPricing(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    customerId: string | null;
    currency: string;
    lines: PosDiscountPricingLine[];
    code?: string;
  },
): Promise<PosDiscountPreviewSelection[]> {
  const now = new Date();
  const previewOrderId = "__pos_cart_preview__";
  const requestedRules = input.code
    ? await findPosDiscountRules(db, {
        tenantId: input.tenantId,
        branchId: input.branchId,
        customerId: input.customerId,
        orderId: previewOrderId,
        now,
        method: "code",
        code: input.code,
      })
    : [];
  if (input.code && requestedRules.length === 0) {
    throw new PosOrderError(
      "DISCOUNT_NOT_FOUND",
      "The discount code was not found or is not active for this cart.",
      404,
    );
  }
  const automaticRules = await findPosDiscountRules(db, {
    tenantId: input.tenantId,
    branchId: input.branchId,
    customerId: input.customerId,
    orderId: previewOrderId,
    now,
    method: "automatic",
  });
  const remaining = new Map(
    input.lines.map((line) => [line.id, moneyToMinor(line.lineAmount)]),
  );
  const context = {
    currency: input.currency,
    lines: input.lines,
    remainingByLine: remaining,
  };
  const selected: PosDiscountPreviewSelection[] = [];
  const requestedRule = requestedRules[0];
  if (requestedRule) {
    const result = pricePosDiscount(context, requestedRule);
    if (!result) {
      throw new PosOrderError(
        "DISCOUNT_NOT_APPLICABLE",
        "This discount code does not meet the cart requirements.",
        422,
      );
    }
    selected.push({ rule: requestedRule, result });
    applyAllocations(remaining, result);
  }

  const automaticCandidates = uniqueRules(automaticRules)
    .filter((rule) => !selected.some((item) => item.rule.id === rule.id))
    .map((rule) => ({ rule, result: pricePosDiscount(context, rule) }))
    .filter(
      (
        candidate,
      ): candidate is {
        rule: PosDiscountRule;
        result: PosDiscountPricingResult;
      } => candidate.result !== null,
    )
    .sort((left, right) =>
      left.result.amountMinor === right.result.amountMinor
        ? left.rule.id.localeCompare(right.rule.id)
        : left.result.amountMinor > right.result.amountMinor
          ? -1
          : 1,
    );
  for (const candidate of automaticCandidates) {
    if (!isCombinable(selected, candidate.rule)) continue;
    const result = pricePosDiscount(context, candidate.rule);
    if (!result) continue;
    selected.push({ rule: candidate.rule, result });
    applyAllocations(remaining, result);
  }
  return selected;
}

function isCombinable(
  selected: SelectedDiscount[],
  candidate: PosDiscountRule,
): boolean {
  return selected.every(({ rule }) => discountsCanCombine(rule, candidate));
}

function uniqueRules(rules: PosDiscountRule[]): PosDiscountRule[] {
  return [...new Map(rules.map((rule) => [rule.id, rule])).values()];
}

function normalizeDiscountIntent(request: ApplyPosOrderDiscountRequest): {
  kind: "code" | "discount_id";
  value: string;
} {
  if (request.code !== undefined) {
    return { kind: "code", value: request.code.trim().toLowerCase() };
  }
  return { kind: "discount_id", value: request.discountId };
}

function discountReceiptMatches(
  receipt: PosDiscountIdempotencyReceiptRecord,
  request: ApplyPosOrderDiscountRequest,
  reason: string,
): boolean {
  const intent = normalizeDiscountIntent(request);
  return (
    receipt.intentKind === intent.kind &&
    receipt.intentValue === intent.value &&
    (receipt.reasonSnapshot === null || receipt.reasonSnapshot === reason)
  );
}

export async function resolveRequestedPosDiscountRule(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    customerId: string | null;
    orderId: string;
    now: Date;
    request: ApplyPosOrderDiscountRequest;
  },
): Promise<PosDiscountRule> {
  const rules = await findPosDiscountRules(db, {
    tenantId: input.tenantId,
    branchId: input.branchId,
    customerId: input.customerId,
    orderId: input.orderId,
    now: input.now,
    ...(input.request.discountId !== undefined
      ? {
          method: "automatic" as const,
          discountIds: [input.request.discountId],
        }
      : { method: "code" as const, code: input.request.code }),
  });
  const rule = rules[0];
  if (!rule) {
    throw new PosOrderError(
      "DISCOUNT_NOT_FOUND",
      "The discount was not found or is not active for this order.",
      404,
    );
  }
  return rule;
}

async function persistSelectedDiscounts(
  db: Database,
  input: {
    order: PosDiscountOrderRecord;
    actorUserId: string;
    selected: SelectedDiscount[];
    existing: PosDiscountApplicationRecord[];
    requestedRuleId?: string;
    idempotencyKey?: string;
  },
): Promise<Map<string, string>> {
  const selectedIds = new Set(input.selected.map(({ rule }) => rule.id));
  for (const application of input.existing) {
    if (!selectedIds.has(application.discountId)) {
      await voidPosDiscountApplicationRecord(db, {
        tenantId: input.order.tenantId,
        applicationId: application.id,
        reason: "Discount is no longer applicable after order re-evaluation.",
        actorUserId: input.actorUserId,
      });
    }
  }

  const existingByDiscount = new Map(
    input.existing.map((application) => [application.discountId, application]),
  );
  const applicationIds = new Map<string, string>();
  for (const selected of input.selected) {
    const existing = existingByDiscount.get(selected.rule.id);
    const applicationId = existing
      ? existing.id
      : await createPosDiscountApplicationRecord(db, {
          tenantId: input.order.tenantId,
          branchId: input.order.branchId,
          customerId: input.order.customerId,
          orderId: input.order.id,
          rule: selected.rule,
          amountMinor: selected.result.amountMinor,
          currency: input.order.currency,
          idempotencyKey:
            selected.rule.id === input.requestedRuleId
              ? input.idempotencyKey
              : undefined,
          actorUserId: input.actorUserId,
        });
    if (existing) {
      await updatePosDiscountApplicationRecord(db, {
        tenantId: input.order.tenantId,
        applicationId,
        rule: selected.rule,
        amountMinor: selected.result.amountMinor,
      });
    }
    applicationIds.set(selected.rule.id, applicationId);
    await replacePosDiscountAllocations(db, {
      tenantId: input.order.tenantId,
      orderId: input.order.id,
      applicationId,
      allocations: selected.result.allocations,
    });
  }
  return applicationIds;
}

/**
 * Re-evaluates all active code applications and all eligible automatic
 * discounts. This function expects to run inside the caller's transaction.
 */
export async function repricePosOrderDiscounts(
  db: Database,
  input: {
    order: PosDiscountOrderRecord;
    actorUserId: string;
    requestedRule?: PosDiscountRule;
    idempotencyKey?: string;
  },
): Promise<string | null> {
  await assertNoPendingManualPayment(db, input.order);

  const now = new Date();
  const existing = await listActivePosDiscountApplicationRecords(db, {
    tenantId: input.order.tenantId,
    orderId: input.order.id,
  });
  const existingIds = existing.map((application) => application.discountId);

  const initialExistingRules = await findPosDiscountRules(db, {
    tenantId: input.order.tenantId,
    branchId: input.order.branchId,
    customerId: input.order.customerId,
    orderId: input.order.id,
    now,
    discountIds: existingIds,
  });
  const initialAutomaticRules = await findPosDiscountRules(db, {
    tenantId: input.order.tenantId,
    branchId: input.order.branchId,
    customerId: input.order.customerId,
    orderId: input.order.id,
    now,
    method: "automatic",
  });
  const candidateIds = uniqueRules([
    ...initialExistingRules,
    ...initialAutomaticRules,
    ...(input.requestedRule ? [input.requestedRule] : []),
  ]).map((rule) => rule.id);
  await lockPosDiscountRules(db, {
    tenantId: input.order.tenantId,
    discountIds: candidateIds,
  });

  // Usage limits are protected by the discount row locks above. Re-read all
  // eligibility and usage counters only after acquiring those locks so two
  // concurrent orders cannot both consume the final available use.
  const lockedAt = new Date();
  const refreshedRules = await findPosDiscountRules(db, {
    tenantId: input.order.tenantId,
    branchId: input.order.branchId,
    customerId: input.order.customerId,
    orderId: input.order.id,
    now: lockedAt,
    discountIds: candidateIds,
  });
  const refreshedById = new Map(refreshedRules.map((rule) => [rule.id, rule]));
  const requestedId = input.requestedRule?.id;
  const requestedRule = requestedId
    ? refreshedById.get(requestedId)
    : undefined;
  if (requestedId && !requestedRule) {
    throw new PosOrderError(
      "DISCOUNT_NOT_APPLICABLE",
      "The discount is no longer eligible for this order.",
      422,
    );
  }
  const existingRules = existingIds.flatMap((id) => {
    const rule = refreshedById.get(id);
    return rule ? [rule] : [];
  });
  const automaticRules = refreshedRules.filter(
    (rule) => rule.method === "automatic",
  );

  const lines = await findPosDiscountOrderLines(db, {
    tenantId: input.order.tenantId,
    orderId: input.order.id,
  });
  const remaining = new Map(
    lines.map((line) => [line.id, moneyToMinor(line.lineAmount)]),
  );
  const context = {
    currency: input.order.currency,
    lines,
    remainingByLine: remaining,
  };
  const existingById = new Map(
    existing.map((application) => [application.discountId, application]),
  );
  const explicitRules = uniqueRules([
    ...existingRules.filter((rule) => rule.method === "code"),
    ...(requestedRule ? [requestedRule] : []),
  ]).sort((left, right) => {
    if (left.id === requestedId) return 1;
    if (right.id === requestedId) return -1;
    const leftAt = existingById.get(left.id)?.appliedAt.getTime() ?? 0;
    const rightAt = existingById.get(right.id)?.appliedAt.getTime() ?? 0;
    return leftAt - rightAt || left.id.localeCompare(right.id);
  });

  const selected: SelectedDiscount[] = [];
  for (const rule of explicitRules) {
    if (!isCombinable(selected, rule)) {
      if (rule.id === requestedId) {
        throw new PosOrderError(
          "DISCOUNT_NOT_COMBINABLE",
          "This discount cannot be combined with an existing order discount.",
          422,
        );
      }
      continue;
    }
    const result = pricePosDiscount(context, rule);
    if (!result) {
      if (rule.id === requestedId) {
        throw new PosOrderError(
          "DISCOUNT_NOT_APPLICABLE",
          "This discount does not meet the order requirements.",
          422,
        );
      }
      continue;
    }
    selected.push({ rule, result });
    applyAllocations(remaining, result);
  }

  const automaticCandidates = uniqueRules(automaticRules)
    .filter((rule) => !selected.some(({ rule: item }) => item.id === rule.id))
    .map((rule) => ({
      rule,
      preview: pricePosDiscount(context, rule),
    }))
    .filter(
      (
        candidate,
      ): candidate is {
        rule: PosDiscountRule;
        preview: PosDiscountPricingResult;
      } => candidate.preview !== null,
    )
    .sort((left, right) =>
      left.preview.amountMinor === right.preview.amountMinor
        ? left.rule.id.localeCompare(right.rule.id)
        : left.preview.amountMinor > right.preview.amountMinor
          ? -1
          : 1,
    );
  for (const candidate of automaticCandidates) {
    if (!isCombinable(selected, candidate.rule)) {
      continue;
    }
    const result = pricePosDiscount(context, candidate.rule);
    if (!result) {
      continue;
    }
    selected.push({ rule: candidate.rule, result });
    applyAllocations(remaining, result);
  }

  const applicationIds = await persistSelectedDiscounts(db, {
    order: input.order,
    actorUserId: input.actorUserId,
    selected,
    existing,
    requestedRuleId: requestedId,
    idempotencyKey: input.idempotencyKey,
  });
  const discountMinor = selected.reduce(
    (total, discount) => total + discount.result.amountMinor,
    BigInt(0),
  );
  const nextVersion = await updatePosDiscountOrderTotals(db, {
    order: input.order,
    subtotalMinor: subtotalMinorFromLines(lines),
    discountMinor,
    actorUserId: input.actorUserId,
  });
  if (nextVersion === 0) {
    throw new PosOrderError(
      "VERSION_CONFLICT",
      "Order has been modified. Refresh and try again.",
      409,
    );
  }
  return requestedId ? (applicationIds.get(requestedId) ?? null) : null;
}

async function loadLockedOrder(
  db: Database,
  authContext: AuthContext,
  orderId: string,
): Promise<PosDiscountOrderRecord> {
  const tenantId = requirePosTenantId(authContext);
  const order = await findPosOrderRawForUpdate(db, { tenantId, orderId });
  if (!order) {
    throw new PosOrderError("ORDER_NOT_FOUND", "Order was not found.", 404);
  }
  requirePosBranchAccess(authContext, order.branchId);
  return order;
}

async function writeDiscountAudit(
  db: Database,
  input: {
    authContext: AuthContext;
    requestMeta?: AuthRequestMeta;
    order: PosDiscountOrderRecord;
    eventType: string;
    reason?: string;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  await writeAuditLog(db, {
    actorUserId: input.authContext.userId,
    tenantId: input.order.tenantId,
    branchId: input.order.branchId,
    eventCategory: "pos_order",
    eventType: input.eventType,
    entityType: "order",
    entityId: input.order.id,
    reason: input.reason,
    metadata: createPosAuditMetadata(input.authContext, input.metadata),
    ipAddress: input.requestMeta?.ipAddress,
    userAgent: input.requestMeta?.userAgent,
  });
}

export async function applyPosOrderDiscount(
  input: PosOrderDiscountRequestInput<ApplyPosOrderDiscountRequest>,
  db: Database = getDb(),
): Promise<PosOrderDetail> {
  const tenantId = requirePosTenantId(input.authContext);
  const reason = authorizePosSensitiveOperation(
    input.authContext,
    "discount",
    input.data.reason,
  );

  return db.transaction(async (tx) => {
    const order = await loadLockedOrder(tx, input.authContext, input.orderId);
    await lockPosDiscountIdempotencyKey(tx, {
      tenantId,
      idempotencyKey: input.data.idempotencyKey,
    });
    const idempotent = await findPosDiscountIdempotencyReceipt(tx, {
      tenantId,
      idempotencyKey: input.data.idempotencyKey,
    });
    if (idempotent) {
      if (
        idempotent.application.orderId !== order.id ||
        !discountReceiptMatches(idempotent, input.data, reason)
      ) {
        throw new PosOrderError(
          "DISCOUNT_IDEMPOTENCY_CONFLICT",
          "The idempotency key is already used by another discount operation.",
          409,
        );
      }
      const detail = await findPosOrderDetail(tx, {
        tenantId,
        orderId: order.id,
      });
      if (!detail) {
        throw new Error("Idempotent discount order could not be loaded.");
      }
      return detail;
    }

    assertDiscountMutable(order);
    assertOrderVersion(order, input.data.version);
    const rule = await resolveRequestedPosDiscountRule(tx, {
      tenantId,
      branchId: order.branchId,
      customerId: order.customerId,
      orderId: order.id,
      now: new Date(),
      request: input.data,
    });
    const applicationId = await repricePosOrderDiscounts(tx, {
      order,
      actorUserId: input.authContext.userId,
      requestedRule: rule,
      idempotencyKey: input.data.idempotencyKey,
    });
    if (!applicationId) {
      throw new Error("Applied discount application could not be resolved.");
    }
    const intent = normalizeDiscountIntent(input.data);
    await createPosDiscountIdempotencyReceipt(tx, {
      tenantId,
      applicationId,
      idempotencyKey: input.data.idempotencyKey,
      intentKind: intent.kind,
      intentValue: intent.value,
      reason,
      actorUserId: input.authContext.userId,
    });
    const detail = await findPosOrderDetail(tx, {
      tenantId,
      orderId: order.id,
    });
    if (!detail) {
      throw new Error("Discounted order could not be loaded.");
    }
    await writeDiscountAudit(tx, {
      authContext: input.authContext,
      requestMeta: input.requestMeta,
      order,
      eventType: "pos.order.discount_applied",
      reason,
      metadata: {
        discountId: rule.id,
        method: rule.method,
        code: rule.code,
        idempotencyKey: input.data.idempotencyKey,
        previousDiscountAmount: order.discountAmount,
        previousTotalAmount: order.totalAmount,
        discountAmount: detail.discountAmount,
        totalAmount: detail.totalAmount,
        paymentStatus: detail.paymentStatus,
        paidAt: detail.paidAt,
      },
    });
    return detail;
  });
}

export async function removePosOrderDiscount(
  input: PosOrderDiscountRequestInput<RemovePosOrderDiscountRequest> & {
    applicationId: string;
  },
  db: Database = getDb(),
): Promise<PosOrderDetail> {
  const tenantId = requirePosTenantId(input.authContext);
  const reason = authorizePosSensitiveOperation(
    input.authContext,
    "discount",
    input.data.reason,
  );

  return db.transaction(async (tx) => {
    const order = await loadLockedOrder(tx, input.authContext, input.orderId);
    assertDiscountMutable(order);
    assertOrderVersion(order, input.data.version);
    await assertNoPendingManualPayment(tx, order);
    const application = await findActivePosDiscountApplication(tx, {
      tenantId,
      orderId: order.id,
      applicationId: input.applicationId,
    });
    if (!application) {
      throw new PosOrderError(
        "DISCOUNT_APPLICATION_NOT_FOUND",
        "The order discount application was not found.",
        404,
      );
    }
    if (application.method === "automatic") {
      throw new PosOrderError(
        "AUTOMATIC_DISCOUNT_CANNOT_BE_REMOVED",
        "Automatic discounts are controlled by their eligibility rules.",
        422,
      );
    }
    await voidPosDiscountApplicationRecord(tx, {
      tenantId,
      applicationId: application.id,
      reason,
      actorUserId: input.authContext.userId,
    });

    const refreshedOrder: PosDiscountOrderRecord = {
      ...order,
      version: order.version,
    };
    await repricePosOrderDiscounts(tx, {
      order: refreshedOrder,
      actorUserId: input.authContext.userId,
    });
    const detail = await findPosOrderDetail(tx, {
      tenantId,
      orderId: order.id,
    });
    if (!detail) {
      throw new Error("Order could not be loaded after discount removal.");
    }
    await writeDiscountAudit(tx, {
      authContext: input.authContext,
      requestMeta: input.requestMeta,
      order,
      eventType: "pos.order.discount_removed",
      reason,
      metadata: {
        applicationId: application.id,
        discountId: application.discountId,
        removedAmount: application.amount,
        previousDiscountAmount: order.discountAmount,
        previousTotalAmount: order.totalAmount,
        discountAmount: detail.discountAmount,
        totalAmount: detail.totalAmount,
        paymentStatus: detail.paymentStatus,
        paidAt: detail.paidAt,
      },
    });
    return detail;
  });
}
