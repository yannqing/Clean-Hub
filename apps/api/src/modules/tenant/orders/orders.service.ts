import { getDb, type Database } from "@cleanhub/db";

import { resolveAllowedBranchIds } from "../../auth/branch-scope.helper.js";
import { AuthError } from "../../auth/auth.errors.js";
import { MediaService } from "../../media/media.service.js";
import {
  assertActiveTenant,
  requireTenantRole,
} from "../../auth/permission.helper.js";
import { PosOrderError } from "../../pos/orders/orders.errors.js";
import {
  changePosOrderStatus,
  createPosOrder,
  createPosOrderItem,
  createPosOrderPayment,
  deletePosOrderItem,
  updatePosOrderItem,
} from "../../pos/orders/orders.service.js";
import {
  createPosPaymentCorrection,
  createPosRefund,
  getPosPaymentAdjustments,
} from "../../pos/payment-adjustments/payment-adjustments.service.js";
import {
  countTenantOrders,
  findTenantOrderDetail,
  findTenantOrderOverview,
  findTenantOrderPaymentTransactions,
  findTenantOrders,
} from "./orders.repository.js";
import { TenantOrdersError } from "./orders.errors.js";
import type {
  ChangeTenantOrderStatusRequest,
  CreateTenantOrderItemRequest,
  CreateTenantOrderPaymentRequest,
  CreateTenantOrderPaymentCorrectionRequest,
  CreateTenantOrderRefundRequest,
  DeleteTenantOrderItemRequest,
  TenantOrderAttachmentUploadRequest,
  TenantOrderAttachmentUploadTicket,
  TenantOrderDetail,
  TenantOrderImportInput,
  TenantOrderImportResponse,
  TenantOrderListInput,
  TenantOrderListResponse,
  TenantOrderOverview,
  TenantOrderOverviewQuery,
  TenantOrderStatus,
  UpdateTenantOrderItemRequest,
} from "./orders.types.js";

function resolveOrderCapabilities(
  order: {
    status: TenantOrderStatus;
    paymentStatus: string;
    paidAmount: string;
    totalAmount: string;
  },
  hasPaidTransaction = false,
) {
  const hasPayment = Number(order.paidAmount) > 0;
  const isFinal = order.status === "delivered" || order.status === "cancelled";
  const canEdit =
    !hasPayment && !["paid", "delivered", "cancelled"].includes(order.status);
  const canCancel = !hasPayment && ["draft", "received"].includes(order.status);
  const canRecordPayment =
    !isFinal && Number(order.totalAmount) > Number(order.paidAmount);
  const canMarkDelivered =
    order.status === "paid" && order.paymentStatus === "paid";
  const allowedNextStatuses: TenantOrderStatus[] = [];

  if (order.status === "draft") allowedNextStatuses.push("received");
  if (canCancel) allowedNextStatuses.push("cancelled");
  if (canMarkDelivered) allowedNextStatuses.push("delivered");

  return {
    canEdit,
    canCancel,
    canRecordPayment,
    canRefundPayments: hasPaidTransaction && Number(order.paidAmount) > 0,
    canCorrectPayments: hasPaidTransaction,
    canMarkDelivered,
    canComment: true,
    allowedNextStatuses,
  };
}

export async function createTenantOrderItem(
  authContext: TenantOrderListInput["authContext"],
  orderId: string,
  data: CreateTenantOrderItemRequest,
  requestMeta: Parameters<typeof createPosOrderItem>[3] = {},
  db: Database = getDb(),
): Promise<TenantOrderDetail> {
  await getTenantOrderDetail(authContext, orderId, db);
  await createPosOrderItem(authContext, orderId, data, requestMeta, db);
  return getTenantOrderDetail(authContext, orderId, db);
}

export async function updateTenantOrderItem(
  authContext: TenantOrderListInput["authContext"],
  orderId: string,
  itemId: string,
  data: UpdateTenantOrderItemRequest,
  requestMeta: Parameters<typeof updatePosOrderItem>[4] = {},
  db: Database = getDb(),
): Promise<TenantOrderDetail> {
  await getTenantOrderDetail(authContext, orderId, db);
  await updatePosOrderItem(authContext, orderId, itemId, data, requestMeta, db);
  return getTenantOrderDetail(authContext, orderId, db);
}

export async function deleteTenantOrderItem(
  authContext: TenantOrderListInput["authContext"],
  orderId: string,
  itemId: string,
  data: DeleteTenantOrderItemRequest,
  requestMeta: Parameters<typeof deletePosOrderItem>[4] = {},
  db: Database = getDb(),
): Promise<TenantOrderDetail> {
  await getTenantOrderDetail(authContext, orderId, db);
  await deletePosOrderItem(authContext, orderId, itemId, data, requestMeta, db);
  return getTenantOrderDetail(authContext, orderId, db);
}

export async function createTenantOrderRefund(
  authContext: TenantOrderListInput["authContext"],
  orderId: string,
  data: CreateTenantOrderRefundRequest,
  requestMeta: Parameters<typeof createPosRefund>[0]["requestMeta"] = {},
  db: Database = getDb(),
): Promise<TenantOrderDetail> {
  await getTenantOrderDetail(authContext, orderId, db);
  await createPosRefund(
    { authContext, requestMeta, data: { ...data, orderId } },
    db,
  );
  return getTenantOrderDetail(authContext, orderId, db);
}

export async function createTenantOrderPaymentCorrection(
  authContext: TenantOrderListInput["authContext"],
  orderId: string,
  data: CreateTenantOrderPaymentCorrectionRequest,
  requestMeta: Parameters<
    typeof createPosPaymentCorrection
  >[0]["requestMeta"] = {},
  db: Database = getDb(),
): Promise<TenantOrderDetail> {
  await getTenantOrderDetail(authContext, orderId, db);
  await createPosPaymentCorrection(
    { authContext, requestMeta, data: { ...data, orderId } },
    db,
  );
  return getTenantOrderDetail(authContext, orderId, db);
}

export async function changeTenantOrderStatus(
  authContext: TenantOrderListInput["authContext"],
  orderId: string,
  data: ChangeTenantOrderStatusRequest,
  requestMeta: Parameters<typeof changePosOrderStatus>[3] = {},
  db: Database = getDb(),
): Promise<TenantOrderDetail> {
  await getTenantOrderDetail(authContext, orderId, db);
  await changePosOrderStatus(authContext, orderId, data, requestMeta, db);
  return getTenantOrderDetail(authContext, orderId, db);
}

export async function createTenantOrderPayment(
  authContext: TenantOrderListInput["authContext"],
  orderId: string,
  data: CreateTenantOrderPaymentRequest,
  requestMeta: Parameters<typeof createPosOrderPayment>[3] = {},
  db: Database = getDb(),
): Promise<TenantOrderDetail> {
  await getTenantOrderDetail(authContext, orderId, db);
  await createPosOrderPayment(authContext, orderId, data, requestMeta, db);
  return getTenantOrderDetail(authContext, orderId, db);
}

async function resolveTenantOrderScope(
  authContext: TenantOrderListInput["authContext"],
  branchId: string | undefined,
  db: Database,
): Promise<{ tenantId: string; allowedBranchIds?: string[] }> {
  requireTenantRole(authContext, ["owner", "manager"]);
  await assertActiveTenant(authContext, db);

  const branchScope = await resolveAllowedBranchIds(authContext, db);
  if (branchId && branchScope !== "all" && !branchScope.includes(branchId)) {
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

export async function listTenantOrders(
  input: TenantOrderListInput,
  db: Database = getDb(),
): Promise<TenantOrderListResponse> {
  const scope = await resolveTenantOrderScope(
    input.authContext,
    input.query.branchId,
    db,
  );
  const repositoryInput = {
    ...scope,
    query: input.query,
  };
  const [data, total] = await Promise.all([
    findTenantOrders(db, repositoryInput),
    countTenantOrders(db, repositoryInput),
  ]);

  return { data, total };
}

export async function getTenantOrderOverview(
  authContext: TenantOrderListInput["authContext"],
  query: TenantOrderOverviewQuery,
  db: Database = getDb(),
): Promise<TenantOrderOverview> {
  const scope = await resolveTenantOrderScope(authContext, query.branchId, db);

  return findTenantOrderOverview(db, {
    ...scope,
    branchId: query.branchId,
    period: query.period,
    createdAfter: query.createdAfter,
    createdBefore: query.createdBefore,
  });
}

export async function getTenantOrderDetail(
  authContext: TenantOrderListInput["authContext"],
  orderId: string,
  db: Database = getDb(),
): Promise<TenantOrderDetail> {
  const scope = await resolveTenantOrderScope(authContext, undefined, db);
  const order = await findTenantOrderDetail(db, {
    tenantId: scope.tenantId,
    orderId,
  });

  if (
    !order ||
    (scope.allowedBranchIds !== undefined &&
      !scope.allowedBranchIds.includes(order.branchId))
  ) {
    throw new TenantOrdersError("ORDER_NOT_FOUND", "Order was not found.");
  }

  const payments = await findTenantOrderPaymentTransactions(db, {
    tenantId: scope.tenantId,
    orderId,
  });
  const { data: paymentAdjustments } = await getPosPaymentAdjustments(
    authContext,
    orderId,
    db,
  );

  return {
    ...order,
    payments,
    paymentAdjustments,
    capabilities: resolveOrderCapabilities(
      order,
      payments.some((payment) => payment.paymentStatus === "paid"),
    ),
  };
}

export async function requestTenantOrderAttachmentUpload(
  authContext: TenantOrderListInput["authContext"],
  data: TenantOrderAttachmentUploadRequest,
  db: Database = getDb(),
  mediaService: MediaService = new MediaService(),
): Promise<TenantOrderAttachmentUploadTicket> {
  const scope = await resolveTenantOrderScope(authContext, undefined, db);
  return mediaService.requestUpload({
    tenantId: scope.tenantId,
    actorUserId: authContext.userId,
    purpose: "order_comment_attachment",
    contentType: data.contentType,
    sizeBytes: data.sizeBytes,
  });
}

export async function importTenantOrders(
  input: TenantOrderImportInput,
  db: Database = getDb(),
): Promise<TenantOrderImportResponse> {
  const scope = await resolveTenantOrderScope(input.authContext, undefined, db);
  const data: TenantOrderDetail[] = [];
  const failures: TenantOrderImportResponse["failures"] = [];

  for (const order of input.data.orders) {
    if (
      scope.allowedBranchIds !== undefined &&
      !scope.allowedBranchIds.includes(order.branchId)
    ) {
      failures.push({
        importKey: order.importKey,
        code: "BRANCH_NOT_ALLOWED",
        message: "The selected branch is outside the current user's scope.",
      });
      continue;
    }

    try {
      const created = await createPosOrder(
        {
          authContext: input.authContext,
          requestMeta: input.requestMeta,
          data: {
            id: order.id,
            orderType: "manual",
            branchId: order.branchId,
            customerId: order.customerId,
            expireAt: order.expireAt,
            notes: order.notes,
            items: order.items,
          },
        },
        db,
      );
      data.push({
        ...created,
        payments: [],
        paymentAdjustments: [],
        capabilities: resolveOrderCapabilities(created),
      });
    } catch (error) {
      if (error instanceof PosOrderError || error instanceof AuthError) {
        failures.push({
          importKey: order.importKey,
          code: error.code,
          message: error.message,
        });
        continue;
      }

      throw error;
    }
  }

  return {
    imported: data.length,
    failed: failures.length,
    failures,
    data,
  };
}
