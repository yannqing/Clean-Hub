import { getDb, type Database } from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import { EmailAdapter } from "../../notifications/email.adapter.js";
import { loadEmailConfig } from "../../notifications/email-config.js";
import type { AuthContext } from "../../auth/auth.types.js";
import { requirePosTenantId } from "../access-control.helper.js";
import { PosOrderError } from "../orders/orders.errors.js";
import { getPosOrder } from "../orders/orders.service.js";
import type { PosOrderDetail } from "../orders/orders.types.js";
import {
  findReceiptDeliveryByIdempotencyKey,
  findReceiptDeliveryRecord,
  insertReceiptDelivery,
  listReceiptDeliveries,
  updateReceiptDeliveryResult,
} from "./receipts.repository.js";
import type {
  DeliverPosReceiptRequest,
  PosReceiptDelivery,
} from "./receipts.types.js";

function buildFiscalReceipt(order: PosOrderDetail): {
  title: string;
  content: string;
} {
  const lines = [
    `CleanHub receipt ${order.id}`,
    `Date: ${order.createdAt}`,
    ...(order.taxRegistrationNumberSnapshot
      ? [`Tax registration: ${order.taxRegistrationNumberSnapshot}`]
      : []),
    "",
    ...order.items.map(
      (item) =>
        `${item.itemName} x ${item.quantity}  ${item.lineAmount} ${order.currency}` +
        (Number(item.taxAmount) !== 0
          ? `  VAT ${Number(item.taxRateSnapshot) * 100}%: ${item.taxAmount}`
          : ""),
    ),
    "",
    `Subtotal: ${order.subtotalAmount} ${order.currency}`,
    `Discount: ${order.discountAmount} ${order.currency}`,
    `Taxable: ${order.taxableAmount} ${order.currency}`,
    `VAT: ${order.taxAmount} ${order.currency}`,
    ...(order.taxExemptionReason
      ? [`Tax exemption: ${order.taxExemptionReason}`]
      : []),
    `Rounding: ${order.roundingAdjustmentAmount} ${order.currency}`,
    `Total: ${order.totalAmount} ${order.currency}`,
    `Payment status: ${order.paymentStatus}`,
  ];
  return { title: `CleanHub receipt ${order.id}`, content: lines.join("\n") };
}

async function sendSms(input: {
  deliveryId: string;
  to: string;
  content: string;
}): Promise<{ externalId?: string; payload: Record<string, unknown> }> {
  const url = process.env.SMS_WEBHOOK_URL;
  if (!url) throw new Error("SMS_WEBHOOK_URL is not configured.");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.SMS_WEBHOOK_TOKEN
        ? { authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({
      idempotencyKey: input.deliveryId,
      to: input.to,
      message: input.content,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!response.ok) {
    throw new Error(
      typeof payload.message === "string"
        ? payload.message
        : `SMS provider returned HTTP ${response.status}.`,
    );
  }
  return {
    externalId:
      typeof payload.id === "string"
        ? payload.id
        : typeof payload.messageId === "string"
          ? payload.messageId
          : undefined,
    payload,
  };
}

async function attemptElectronicReceiptDelivery(
  db: Database,
  input: {
    tenantId: string;
    id: string;
    attemptNumber: number;
    channel: "email" | "sms";
    destination: string;
    title: string;
    content: string;
  },
): Promise<PosReceiptDelivery> {
  try {
    if (input.channel === "email") {
      const result = await new EmailAdapter(loadEmailConfig()).send({
        deliveryId: `${input.id}:attempt:${input.attemptNumber}`,
        to: input.destination,
        subject: input.title,
        text: input.content,
      });
      return updateReceiptDeliveryResult(db, {
        tenantId: input.tenantId,
        id: input.id,
        status: "sent",
        provider: "smtp",
        externalId: result.externalId,
      });
    }
    const result = await sendSms({
      deliveryId: `${input.id}:attempt:${input.attemptNumber}`,
      to: input.destination,
      content: input.content,
    });
    return updateReceiptDeliveryResult(db, {
      tenantId: input.tenantId,
      id: input.id,
      status: "sent",
      provider: "sms_webhook",
      externalId: result.externalId,
      providerPayload: result.payload,
    });
  } catch (error) {
    return updateReceiptDeliveryResult(db, {
      tenantId: input.tenantId,
      id: input.id,
      status: "failed",
      provider: input.channel === "email" ? "smtp" : "sms_webhook",
      failureReason:
        error instanceof Error ? error.message : "Receipt delivery failed.",
    });
  }
}

export async function deliverPosOrderReceipt(
  input: {
    authContext: AuthContext;
    orderId: string;
    data: DeliverPosReceiptRequest;
  },
  db: Database = getDb(),
): Promise<PosReceiptDelivery> {
  const tenantId = requirePosTenantId(input.authContext);
  const existing = await findReceiptDeliveryByIdempotencyKey(db, {
    tenantId,
    idempotencyKey: input.data.idempotencyKey,
  });
  if (existing) return existing;

  const order = await getPosOrder(
    {
      authContext: input.authContext,
      orderId: input.orderId,
    },
    db,
  );
  const receipt = buildFiscalReceipt(order);
  const created = await insertReceiptDelivery(db, {
    id: createId(),
    tenantId,
    branchId: order.branchId,
    orderId: order.id,
    channel: input.data.channel,
    destination: input.data.destination,
    idempotencyKey: input.data.idempotencyKey,
    receiptTitle: receipt.title,
    receiptContent: receipt.content,
    createdBy: input.authContext.userId,
  });
  if (!created) {
    const concurrent = await findReceiptDeliveryByIdempotencyKey(db, {
      tenantId,
      idempotencyKey: input.data.idempotencyKey,
    });
    if (concurrent) return concurrent;
    throw new Error("Receipt delivery could not be created.");
  }

  if (input.data.channel === "none") {
    return updateReceiptDeliveryResult(db, {
      tenantId,
      id: created.id,
      status: "skipped",
      provider: "operator_choice",
    });
  }
  if (input.data.channel === "print") {
    return updateReceiptDeliveryResult(db, {
      tenantId,
      id: created.id,
      status: input.data.printStatus === "sent" ? "sent" : "failed",
      provider: "pos_local_printer",
      failureReason: input.data.failureReason,
    });
  }

  return attemptElectronicReceiptDelivery(db, {
    tenantId,
    id: created.id,
    attemptNumber: 1,
    channel: input.data.channel,
    destination: input.data.destination!,
    title: receipt.title,
    content: receipt.content,
  });
}

export async function getPosOrderReceiptDeliveries(
  authContext: AuthContext,
  orderId: string,
  db: Database = getDb(),
) {
  const tenantId = requirePosTenantId(authContext);
  await getPosOrder({ authContext, orderId }, db);
  return { data: await listReceiptDeliveries(db, { tenantId, orderId }) };
}

export async function retryPosOrderReceiptDelivery(
  input: { authContext: AuthContext; orderId: string; deliveryId: string },
  db: Database = getDb(),
): Promise<PosReceiptDelivery> {
  const tenantId = requirePosTenantId(input.authContext);
  await getPosOrder(
    { authContext: input.authContext, orderId: input.orderId },
    db,
  );
  const delivery = await findReceiptDeliveryRecord(db, {
    tenantId,
    orderId: input.orderId,
    deliveryId: input.deliveryId,
  });
  if (!delivery) {
    throw new PosOrderError(
      "ORDER_NOT_FOUND",
      "Receipt delivery was not found.",
      404,
    );
  }
  if (
    delivery.status !== "failed" ||
    (delivery.channel !== "email" && delivery.channel !== "sms") ||
    !delivery.destination
  ) {
    throw new PosOrderError(
      "VALIDATION_ERROR",
      "Only a failed email or SMS receipt delivery can be retried.",
      422,
    );
  }
  return attemptElectronicReceiptDelivery(db, {
    tenantId,
    id: delivery.id,
    attemptNumber: delivery.attemptCount + 1,
    channel: delivery.channel,
    destination: delivery.destination,
    title: delivery.receiptTitle,
    content: delivery.receiptContent,
  });
}
