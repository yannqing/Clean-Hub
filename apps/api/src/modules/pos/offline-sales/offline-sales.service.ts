import { getDb, type Database } from "@cleanhub/db";

import { writeAuditLog } from "../../audit/audit.helper.js";
import { findBranchById } from "../../tenant/branches/branches.repository.js";
import {
  authorizePosSensitiveOperation,
  createPosAuditMetadata,
  requirePosBranchAccess,
  requirePosRole,
  requirePosTerminalContext,
  requirePosTenantId,
} from "../access-control.helper.js";
import { previewCurrentPosCart } from "../carts/carts.service.js";
import { PosOrderError } from "../orders/orders.errors.js";
import { findPaymentTransactionByIdempotencyKey } from "../orders/orders.repository.js";
import {
  checkoutPosOrder,
  createPosOrderPayment,
} from "../orders/orders.service.js";
import {
  findCashDrawerSessionByIdForUpdate,
  findRegisterSessionByIdForUpdate,
} from "../staff/staff.repository.js";
import {
  findOfflineSaleException,
  listOfflineSaleExceptions,
  resolveOfflineSaleExceptionRecord,
  upsertOfflineSaleException,
} from "./offline-sales.repository.js";
import type {
  PosOfflineCashCommand,
  PosOfflineSaleException,
  PosOfflineSaleMutationInput,
  ReportPosOfflineSaleExceptionRequest,
  ResolvePosOfflineSaleExceptionRequest,
  ResolvePosOfflineSaleExceptionResponse,
} from "./offline-sales.types.js";

function cashPaymentFromCommand(command: PosOfflineCashCommand) {
  return command.type === "checkout" ? command.input.payment : command.input;
}

function requireCashCommand(command: PosOfflineCashCommand) {
  const payment = cashPaymentFromCommand(command);
  if (
    !payment ||
    payment.paymentMethod !== "cash" ||
    !payment.tenderedAmount ||
    !payment.registerSessionId ||
    !payment.occurredAt
  ) {
    throw new PosOrderError(
      "VALIDATION_ERROR",
      "Only failed offline cash commands can be reported here.",
      422,
    );
  }
  return {
    ...payment,
    tenderedAmount: payment.tenderedAmount,
    shiftId: payment.shiftId ?? null,
    registerSessionId: payment.registerSessionId,
    cashDrawerSessionId: payment.cashDrawerSessionId ?? null,
    occurredAt: payment.occurredAt,
  };
}

function canAccessException(
  staffId: string,
  authContext: PosOfflineSaleMutationInput<unknown>["authContext"],
): boolean {
  return (
    staffId === authContext.userId ||
    authContext.role === "owner" ||
    authContext.role === "manager"
  );
}

export async function reportPosOfflineSaleException(
  input: PosOfflineSaleMutationInput<ReportPosOfflineSaleExceptionRequest>,
  db: Database = getDb(),
): Promise<PosOfflineSaleException> {
  const terminal = requirePosTerminalContext(input.authContext);
  const payment = requireCashCommand(input.data.command);
  const commandOrderId =
    input.data.command.type === "checkout"
      ? input.data.command.input.order.id
      : input.data.command.orderId;
  if (
    commandOrderId !== input.data.orderId ||
    payment.idempotencyKey !== input.data.commandId
  ) {
    throw new PosOrderError(
      "VALIDATION_ERROR",
      "The offline command identity does not match the exception report.",
      422,
    );
  }
  if (
    input.data.command.type === "checkout" &&
    (input.data.command.input.order.orderType !== "manual" ||
      input.data.command.input.order.branchId !== terminal.branchId)
  ) {
    throw new PosOrderError(
      "BRANCH_NOT_ALLOWED",
      "The offline checkout does not belong to this terminal branch.",
      403,
    );
  }

  return db.transaction(async (tx) => {
    const branch = await findBranchById(tx, {
      tenantId: terminal.tenantId,
      branchId: terminal.branchId,
    });
    if (!branch) {
      throw new PosOrderError(
        "BRANCH_NOT_ALLOWED",
        "The terminal branch was not found.",
        404,
      );
    }
    const registerSession = await findRegisterSessionByIdForUpdate(tx, {
      tenantId: terminal.tenantId,
      registerSessionId: payment.registerSessionId,
    });
    if (
      !registerSession ||
      registerSession.terminalId !== terminal.terminalId ||
      registerSession.branchId !== terminal.branchId
    ) {
      throw new PosOrderError(
        "REGISTER_REQUIRED",
        "The exception report does not belong to this terminal's register session.",
        403,
      );
    }
    if (payment.cashDrawerSessionId) {
      const cashSession = await findCashDrawerSessionByIdForUpdate(tx, {
        tenantId: terminal.tenantId,
        cashDrawerSessionId: payment.cashDrawerSessionId,
      });
      if (
        !cashSession ||
        cashSession.registerSessionId !== registerSession.id
      ) {
        throw new PosOrderError(
          "CASH_SESSION_REQUIRED",
          "The exception report does not belong to this register's cash session.",
          403,
        );
      }
    }

    const exception = await upsertOfflineSaleException(tx, {
      tenantId: terminal.tenantId,
      branchId: terminal.branchId,
      terminalId: terminal.terminalId,
      shiftId: payment.shiftId,
      registerSessionId: payment.registerSessionId,
      cashDrawerSessionId: payment.cashDrawerSessionId,
      staffId: input.authContext.userId,
      commandId: input.data.commandId,
      orderId: input.data.orderId,
      operationType: input.data.command.type,
      expectedTotalAmount:
        input.data.command.type === "checkout"
          ? input.data.command.input.expectedTotalAmount
          : input.data.command.input.amount,
      tenderedAmount: payment.tenderedAmount,
      currency: branch.defaultCurrency,
      command: input.data.command,
      failureCode: input.data.failureCode,
      failureMessage: input.data.failureMessage,
    });
    await writeAuditLog(tx, {
      tenantId: terminal.tenantId,
      branchId: terminal.branchId,
      actorUserId: input.authContext.userId,
      eventCategory: "pos.offline_cash",
      eventType: "pos.offline_cash.exception_reported",
      entityType: "pos_offline_sale_exception",
      entityId: exception.id,
      success: false,
      metadata: createPosAuditMetadata(input.authContext, {
        commandId: exception.commandId,
        orderId: exception.orderId,
        failureCode: exception.failureCode,
        failureCount: exception.failureCount,
      }),
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
    return exception;
  });
}

export async function getPosOfflineSaleException(
  authContext: PosOfflineSaleMutationInput<unknown>["authContext"],
  commandId: string,
  db: Database = getDb(),
): Promise<PosOfflineSaleException | null> {
  const tenantId = requirePosTenantId(authContext);
  const row = await findOfflineSaleException(db, { tenantId, commandId });
  if (!row) return null;
  requirePosBranchAccess(authContext, row.exception.branchId);
  if (!canAccessException(row.exception.staffId, authContext)) {
    throw new PosOrderError(
      "PAYMENT_CONFIRMATION_FORBIDDEN",
      "This offline cash exception belongs to another operator.",
      403,
    );
  }
  return row.exception;
}

export async function listPosOfflineSaleExceptions(
  authContext: PosOfflineSaleMutationInput<unknown>["authContext"],
  query: { status: "open" | "resolved"; limit: number },
  db: Database = getDb(),
): Promise<{ data: PosOfflineSaleException[] }> {
  const terminal = requirePosTerminalContext(authContext);
  requirePosRole(authContext, ["owner", "manager"]);
  return {
    data: await listOfflineSaleExceptions(db, {
      tenantId: terminal.tenantId,
      branchId: terminal.branchId,
      status: query.status,
      limit: query.limit,
    }),
  };
}

async function retryOfflineCashCommand(
  authContext: PosOfflineSaleMutationInput<unknown>["authContext"],
  command: PosOfflineCashCommand,
  db: Database,
) {
  if (command.type === "payment") {
    return createPosOrderPayment(
      authContext,
      command.orderId,
      command.input,
      {},
      db,
    );
  }
  if (command.input.order.orderType !== "manual") {
    throw new PosOrderError(
      "VALIDATION_ERROR",
      "Only manual offline checkouts can be repriced for recovery.",
      422,
    );
  }
  const preview = await previewCurrentPosCart(
    {
      authContext,
      data: {
        branchId: command.input.order.branchId,
        customerId: command.input.order.customerId,
        items: command.input.order.items,
        discountCode: command.input.order.discountCode,
      },
    },
    db,
  );
  return checkoutPosOrder(
    authContext,
    { ...command.input, expectedTotalAmount: preview.totalAmount },
    {},
    db,
  );
}

export async function resolvePosOfflineSaleException(
  commandId: string,
  input: PosOfflineSaleMutationInput<ResolvePosOfflineSaleExceptionRequest>,
  db: Database = getDb(),
): Promise<ResolvePosOfflineSaleExceptionResponse> {
  const tenantId = requirePosTenantId(input.authContext);
  const reason = authorizePosSensitiveOperation(
    input.authContext,
    "offline_cash_reconciliation",
    input.data.reason,
  );
  // This moves physical cash: a retry re-collects it and a refund hands it
  // back. Both the read and the resolving write must happen under one
  // transaction with the row locked, or two concurrent operators can each pass
  // the "already resolved" check and settle the same exception twice.
  return db.transaction(async (tx) => {
    const row = await findOfflineSaleException(tx, {
      tenantId,
      commandId,
      forUpdate: true,
    });
    if (!row) {
      throw new PosOrderError(
        "PAYMENT_NOT_FOUND",
        "Offline cash exception was not found.",
        404,
      );
    }
    requirePosBranchAccess(input.authContext, row.exception.branchId);
    if (row.exception.status === "resolved") {
      return { exception: row.exception, result: null };
    }

    const result =
      input.data.action === "retry_latest"
        ? await retryOfflineCashCommand(input.authContext, row.command, tx)
        : null;
    const resolution =
      input.data.action === "cash_refunded" ? "cash_refunded" : "recovered";
    const exception = await resolveOfflineSaleExceptionRecord(tx, {
      tenantId,
      commandId,
      resolution,
      reason,
      actorUserId: input.authContext.userId,
    });
    if (!exception) {
      throw new Error("Resolved offline cash exception was lost.");
    }
    await writeAuditLog(tx, {
      tenantId,
      branchId: exception.branchId,
      actorUserId: input.authContext.userId,
      eventCategory: "pos.offline_cash",
      eventType: `pos.offline_cash.${resolution}`,
      entityType: "pos_offline_sale_exception",
      entityId: exception.id,
      reason,
      before: row.exception,
      after: exception,
      metadata: createPosAuditMetadata(input.authContext, {
        commandId,
        orderId: exception.orderId,
      }),
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
    return { exception, result };
  });
}

export async function acknowledgeRecoveredOfflineSaleException(
  commandId: string,
  input: PosOfflineSaleMutationInput<Record<string, never>>,
  db: Database = getDb(),
): Promise<PosOfflineSaleException | null> {
  const tenantId = requirePosTenantId(input.authContext);
  // Races resolvePosOfflineSaleException for the same row, so it needs the
  // same transaction + row lock: a terminal auto-acknowledging a recovered
  // replay must not silently overwrite a manager's concurrent cash decision.
  return db.transaction(async (tx) => {
    const row = await findOfflineSaleException(tx, {
      tenantId,
      commandId,
      forUpdate: true,
    });
    if (!row || row.exception.status === "resolved") {
      return row?.exception ?? null;
    }
    requirePosBranchAccess(input.authContext, row.exception.branchId);
    if (!canAccessException(row.exception.staffId, input.authContext)) {
      throw new PosOrderError(
        "PAYMENT_CONFIRMATION_FORBIDDEN",
        "This exception belongs to another operator.",
        403,
      );
    }
    const payment = await findPaymentTransactionByIdempotencyKey(tx, {
      tenantId,
      idempotencyKey: commandId,
    });
    if (!payment || payment.paymentStatus !== "paid") {
      throw new PosOrderError(
        "PAYMENT_NOT_FOUND",
        "The recovered cash payment could not be verified.",
        409,
      );
    }
    return resolveOfflineSaleExceptionRecord(tx, {
      tenantId,
      commandId,
      resolution: "recovered",
      reason: "Offline replay completed successfully.",
      actorUserId: input.authContext.userId,
    });
  });
}
