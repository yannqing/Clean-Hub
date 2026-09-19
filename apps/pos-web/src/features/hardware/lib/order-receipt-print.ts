import type {
  PosBranchSummary,
  PosOrderDetail,
  PosPaymentTransaction,
} from "@cleanhub/api-client";
import { createId } from "@cleanhub/id";
import { createScopedPrintJobQueue } from "@cleanhub/offline";
import { buildPosReceiptText, type PrintLocale } from "@cleanhub/hardware";
import {
  allocateReceiptLineMinor,
  moneyToReceiptMinor,
} from "@cleanhub/domain/currency";

import type { PosCartSnapshot } from "@/features/cart/cart.types";
import {
  buildPosOrderReceipt,
  getPosReceiptCopy,
} from "@/features/orders/lib/order-receipt";

import { getPosHardwareBridge, getPosOfflineStorage } from "./desktop-bridge";
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
  printerId: string;
  operatorName?: string | null;
  terminalName?: string | null;
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
      qrCodeContent: receipt.qrCodeContent,
      autoPrint: input.autoPrint,
      copies: input.copies,
      printerId: input.printerId,
    },
  });
  notifyPosPrintQueueUpdated();
  if (!input.autoPrint) return "queued";
  try {
    const result = await queue.retry(job.id, (storedJob) =>
      executePosPrintJob(storedJob, getPosHardwareBridge()),
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
  printerId: string;
  cashTendered?: string;
  changeAmount?: string;
  operatorName?: string | null;
  terminalName?: string | null;
  scope: { tenantId: string; branchId: string; terminalId: string };
}): Promise<"queued" | "printed" | "failed"> {
  // An offline cart has no server-priced total, so it is summed here -- but
  // summed from the exact line amounts and rounded once at the end. Rounding
  // each line first and adding those up is what made a receipt's column
  // disagree with its own total in a zero-decimal currency.
  const lineAmounts = input.cart.lines.map((line) =>
    line.kind === "product"
      ? String(Number(line.unitAmount) * line.quantity)
      : line.lineAmount,
  );
  const totalAmount = lineAmounts.reduce(
    (sum, amount) => sum + Number(amount || 0),
    0,
  );
  const totalMinor = moneyToReceiptMinor(totalAmount, input.cart.currency);
  const lineAmountsMinor = allocateReceiptLineMinor(
    lineAmounts,
    input.cart.currency,
    totalMinor,
  );
  const title = `OFF-${input.cart.checkoutId.slice(-8).toUpperCase()}`;
  const copy = getPosReceiptCopy(input.locale);
  const content = buildPosReceiptText(
    {
      receiptNo: title,
      orderCode: title,
      issuedAt: new Date(),
      currency: input.cart.currency,
      merchantName: input.branch?.merchantName || "CleanHub",
      branchName: input.branch?.receiptName || input.branch?.name,
      cashierName: input.operatorName ?? undefined,
      terminalName: input.terminalName ?? undefined,
      customerName: input.cart.customer?.name ?? copy.walkInCustomer,
      fields: input.branch?.receiptFields,
      items: input.cart.lines.map((line, lineIndex) => ({
        name: line.name,
        quantity:
          line.kind === "product"
            ? line.quantity
            : Number(line.weight ?? line.quantity),
        unitAmountMinor: moneyToReceiptMinor(
          line.unitAmount,
          input.cart.currency,
        ),
        totalAmountMinor: lineAmountsMinor[lineIndex] ?? 0,
        sku: line.kind === "product" ? line.sku : undefined,
        barcode:
          line.kind === "product" ? (line.barcode ?? undefined) : undefined,
      })),
      subtotalMinor: totalMinor,
      discountMinor: 0,
      totalMinor,
      paidMinor: input.paymentMethod === "cash" ? totalMinor : 0,
      cashTenderedMinor:
        input.paymentMethod === "cash" && input.cashTendered
          ? moneyToReceiptMinor(input.cashTendered, input.cart.currency)
          : undefined,
      changeMinor:
        input.paymentMethod === "cash" && input.changeAmount
          ? moneyToReceiptMinor(input.changeAmount, input.cart.currency)
          : undefined,
      balanceMinor: input.paymentMethod === "cash" ? 0 : totalMinor,
      paymentMethod:
        input.paymentMethod === "cash" ? copy.paymentMethods.cash : undefined,
      receiptAddress:
        input.branch?.receiptAddress || input.branch?.address || undefined,
      receiptPhone:
        input.branch?.receiptPhone || input.branch?.phone || undefined,
      thankYouMessage: [
        input.branch?.receiptThankYouMessage,
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
      autoPrint: input.autoPrint,
      copies: input.copies,
      printerId: input.printerId,
    },
  });
  notifyPosPrintQueueUpdated();
  if (!input.autoPrint) return "queued";
  try {
    const result = await queue.retry(job.id, (storedJob) =>
      executePosPrintJob(storedJob, getPosHardwareBridge()),
    );
    notifyPosPrintQueueUpdated();
    return result.status === "printed" ? "printed" : "failed";
  } catch {
    notifyPosPrintQueueUpdated();
    return "failed";
  }
}

function toPrintLocale(locale: string): PrintLocale {
  if (locale === "zh-CN" || locale === "fr") return locale;
  return "en";
}
