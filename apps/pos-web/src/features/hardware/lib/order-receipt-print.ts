import type {
  PosBranchSummary,
  PosOrderDetail,
  PosPaymentTransaction,
} from "@cleanhub/api-client";
import { createId } from "@cleanhub/id";
import { createScopedPrintJobQueue } from "@cleanhub/offline";
import { buildPosReceiptText, type PrintLocale } from "@cleanhub/hardware";

import type { PosCartSnapshot } from "@/features/cart/cart.types";
import { buildPosOrderReceipt } from "@/features/orders/lib/order-receipt";

import { getDesktopBridge, getPosOfflineStorage } from "./desktop-bridge";
import {
  executePosPrintJob,
  notifyPosPrintQueueUpdated,
  type PosPrintJobPayload,
} from "./pos-print-job";

export async function queuePosOrderReceipt(input: {
  autoPrint: boolean;
  branch: PosBranchSummary | null;
  copies: number;
  locale: string;
  order: PosOrderDetail;
  payments: PosPaymentTransaction[];
  scope: { tenantId: string; branchId: string; terminalId: string };
}): Promise<"queued" | "printed" | "failed"> {
  const receipt = buildPosOrderReceipt(input);
  const queue = createScopedPrintJobQueue<PosPrintJobPayload>({
    storage: getPosOfflineStorage(),
    scope: input.scope,
  });
  const job = await queue.enqueue({
    id: createId(),
    idempotencyKey: `pos-print:receipt:${input.order.id}:initial`,
    payload: {
      documentType: "receipt",
      entityId: input.order.id,
      title: receipt.title,
      content: receipt.content,
      copies: input.copies,
    },
  });
  notifyPosPrintQueueUpdated();
  if (!input.autoPrint) return "queued";
  try {
    const result = await queue.retry(job.id, (storedJob) =>
      executePosPrintJob(storedJob, getDesktopBridge()?.hardware ?? null),
    );
    notifyPosPrintQueueUpdated();
    return result.status === "printed" ? "printed" : "failed";
  } catch {
    notifyPosPrintQueueUpdated();
    return "failed";
  }
}

export async function queuePosOfflineCartReceipt(input: {
  autoPrint: boolean;
  branch: PosBranchSummary | null;
  cart: PosCartSnapshot;
  copies: number;
  locale: string;
  paymentMethod: "cash" | "later";
  cashTendered?: string;
  changeAmount?: string;
  scope: { tenantId: string; branchId: string; terminalId: string };
}): Promise<"queued" | "printed" | "failed"> {
  const totalMinor = input.cart.lines.reduce(
    (sum, line) =>
      sum +
      toMinorUnits(
        line.kind === "product"
          ? String(Number(line.unitAmount) * line.quantity)
          : line.lineAmount,
        input.cart.currency,
      ),
    0,
  );
  const title = `OFF-${input.cart.checkoutId.slice(-8).toUpperCase()}`;
  const content = buildPosReceiptText(
    {
      receiptNo: title,
      orderCode: title,
      issuedAt: new Date(),
      currency: input.cart.currency,
      merchantName:
        input.branch?.receiptName || input.branch?.name || "CleanHub",
      branchName: input.branch?.name,
      customerName: input.cart.customer?.name ?? "Walk-in customer",
      items: input.cart.lines.map((line) => ({
        name: line.name,
        quantity:
          line.kind === "product"
            ? line.quantity
            : Number(line.weight ?? line.quantity),
        unitAmountMinor: toMinorUnits(line.unitAmount, input.cart.currency),
        totalAmountMinor: toMinorUnits(
          line.kind === "product"
            ? String(Number(line.unitAmount) * line.quantity)
            : line.lineAmount,
          input.cart.currency,
        ),
      })),
      subtotalMinor: totalMinor,
      discountMinor: 0,
      totalMinor,
      paidMinor: input.paymentMethod === "cash" ? totalMinor : 0,
      cashTenderedMinor:
        input.paymentMethod === "cash" && input.cashTendered
          ? toMinorUnits(input.cashTendered, input.cart.currency)
          : undefined,
      changeMinor:
        input.paymentMethod === "cash" && input.changeAmount
          ? toMinorUnits(input.changeAmount, input.cart.currency)
          : undefined,
      balanceMinor: input.paymentMethod === "cash" ? 0 : totalMinor,
      paymentMethod: input.paymentMethod === "cash" ? "Cash" : undefined,
      footer: [
        input.branch?.receiptAddress,
        input.branch?.receiptPhone,
        input.locale === "zh-CN"
          ? "离线暂存小票 · 联网后生成正式订单"
          : input.locale === "fr"
            ? "Reçu hors ligne · Commande définitive après synchronisation"
            : "Offline receipt · Final order after synchronization",
      ]
        .filter(Boolean)
        .join(" · "),
    },
    { locale: toPrintLocale(input.locale) },
  );
  const queue = createScopedPrintJobQueue<PosPrintJobPayload>({
    storage: getPosOfflineStorage(),
    scope: input.scope,
  });
  const job = await queue.enqueue({
    id: createId(),
    idempotencyKey: `pos-print:receipt:${input.cart.checkoutId}:offline`,
    payload: {
      documentType: "receipt",
      entityId: input.cart.checkoutId,
      title,
      content,
      copies: input.copies,
    },
  });
  notifyPosPrintQueueUpdated();
  if (!input.autoPrint) return "queued";
  try {
    const result = await queue.retry(job.id, (storedJob) =>
      executePosPrintJob(storedJob, getDesktopBridge()?.hardware ?? null),
    );
    notifyPosPrintQueueUpdated();
    return result.status === "printed" ? "printed" : "failed";
  } catch {
    notifyPosPrintQueueUpdated();
    return "failed";
  }
}

function toMinorUnits(value: string, currency: string): number {
  const fractionDigits =
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  return Math.round(Number(value) * 10 ** fractionDigits);
}

function toPrintLocale(locale: string): PrintLocale {
  if (locale === "zh-CN" || locale === "fr") return locale;
  return "en";
}
