import type {
  PosBranchSummary,
  PosOrderDetail,
  PosPaymentTransaction,
} from "@cleanhub/api-client";
import { buildPosReceiptText, type PrintLocale } from "@cleanhub/hardware";
import {
  formatPosOrderCode,
  formatPosOrderQrPayload,
} from "@cleanhub/domain/order-codes";

import { MOBILE_MONEY_PROVIDER_LABELS } from "../constants";
import { formatOrderItemMeasurement } from "./order-measurement";

export function buildPosOrderReceipt(input: {
  branch: PosBranchSummary | null;
  locale: string;
  order: PosOrderDetail;
  payments: PosPaymentTransaction[];
  operatorName?: string | null;
  terminalName?: string | null;
}): { content: string; qrCodeContent?: string; title: string } {
  const { branch, order, payments } = input;
  const locale = toPrintLocale(input.locale);
  const copy = receiptCopy[locale];
  // The customer brings this slip back to collect their garments, so each line
  // carries the ticket it belongs to and its label code.
  const ticketReferences = order.ticketReferences ?? [];
  const ticketNoByTicketId = new Map(
    ticketReferences.map((reference) => [
      reference.ticketId,
      reference.ticketNo,
    ]),
  );
  const items = order.items.map((item) => {
    const quantity =
      item.pricingUnit === "per_kg"
        ? Number(item.weight ?? item.quantity)
        : Number(item.quantity);
    const ticketNo = item.ticketId
      ? ticketNoByTicketId.get(item.ticketId)
      : null;
    const details = [
      formatOrderItemMeasurement(item, input.locale),
      item.itemIdentifier ? `${copy.label}: ${item.itemIdentifier}` : null,
      ticketNo ? `${copy.ticket}: ${ticketNo}` : null,
      item.itemColor ? `${copy.color}: ${item.itemColor}` : null,
      item.specialRequest ? item.specialRequest : null,
    ].filter((value): value is string => Boolean(value));
    return {
      name: item.itemName,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      unitAmountMinor: toMinorUnits(item.chargedUnitAmount, order.currency),
      totalAmountMinor: toMinorUnits(item.lineAmount, order.currency),
      sku: item.sku ?? undefined,
      barcode: item.barcode ?? undefined,
      note: details.length > 0 ? details.join(" · ") : undefined,
    };
  });
  const earliestPickupAt = ticketReferences
    .map((reference) => reference.expectedPickupAt)
    .filter((value): value is string => Boolean(value))
    .sort()[0];
  const totalMinor = toMinorUnits(order.totalAmount, order.currency);
  const paymentMethod = [
    ...new Set(
      payments
        .filter((payment) => payment.paymentStatus === "paid")
        .map((payment) =>
          payment.provider
            ? MOBILE_MONEY_PROVIDER_LABELS[payment.provider]
            : copy.paymentMethods[payment.paymentMethod],
        ),
    ),
  ].join(" / ");
  const paidCash = payments.filter(
    (payment) =>
      payment.paymentMethod === "cash" && payment.paymentStatus === "paid",
  );
  const title = `RC-${order.id.slice(-8).toUpperCase()}`;
  const qrCodeContent = branch?.receiptFields.includes("order_qr_code")
    ? formatPosOrderQrPayload(order.id)
    : undefined;
  return {
    title,
    qrCodeContent,
    content: buildPosReceiptText(
      {
        receiptNo: title,
        orderCode: formatPosOrderCode(order.id),
        issuedAt: order.paidAt ?? order.updatedAt,
        currency: order.currency,
        merchantName: branch?.merchantName || "CleanHub",
        branchName: branch?.receiptName || branch?.name,
        cashierName: input.operatorName ?? undefined,
        terminalName: input.terminalName ?? undefined,
        customerName: order.customerName ?? copy.walkInCustomer,
        fields: branch?.receiptFields,
        items,
        subtotalMinor: toMinorUnits(order.subtotalAmount, order.currency),
        discountMinor: toMinorUnits(order.discountAmount, order.currency),
        taxableMinor: toMinorUnits(order.taxableAmount, order.currency),
        taxMinor: toMinorUnits(order.taxAmount, order.currency),
        taxRate: order.taxRateSnapshot,
        roundingMinor: toMinorUnits(
          order.roundingAdjustmentAmount,
          order.currency,
        ),
        taxRegistrationNumber: order.taxRegistrationNumberSnapshot ?? undefined,
        taxExemptionReason: order.taxExemptionReason ?? undefined,
        totalMinor,
        paidMinor: toMinorUnits(order.paidAmount, order.currency),
        cashTenderedMinor:
          paidCash.length > 0
            ? paidCash.reduce(
                (sum, payment) =>
                  sum +
                  toMinorUnits(
                    payment.tenderedAmount ?? payment.amount,
                    payment.currency,
                  ),
                0,
              )
            : undefined,
        changeMinor:
          paidCash.length > 0
            ? paidCash.reduce(
                (sum, payment) =>
                  sum +
                  toMinorUnits(payment.changeAmount ?? "0", payment.currency),
                0,
              )
            : undefined,
        balanceMinor: Math.max(
          0,
          totalMinor - toMinorUnits(order.paidAmount, order.currency),
        ),
        paymentMethod: paymentMethod || undefined,
        expectedPickup: earliestPickupAt
          ? `${copy.expectedPickup}: ${formatReceiptPickup(earliestPickupAt, locale)}`
          : undefined,
        receiptAddress: branch?.receiptAddress || branch?.address || undefined,
        receiptPhone: branch?.receiptPhone || branch?.phone || undefined,
        thankYouMessage: branch?.receiptThankYouMessage || copy.thankYou,
      },
      { locale },
    ),
  };
}

export function getPosReceiptCopy(locale: string) {
  return receiptCopy[toPrintLocale(locale)];
}

const receiptCopy = {
  en: {
    color: "Color",
    expectedPickup: "Ready for pickup",
    label: "Tag",
    thankYou: "Thank you",
    ticket: "Ticket",
    walkInCustomer: "Walk-in customer",
    paymentMethods: { cash: "Cash", card: "Card", app: "Mobile payment" },
  },
  fr: {
    color: "Couleur",
    expectedPickup: "Retrait prévu",
    label: "Étiquette",
    thankYou: "Merci",
    ticket: "Bon",
    walkInCustomer: "Client de passage",
    paymentMethods: {
      cash: "Espèces",
      card: "Carte",
      app: "Paiement mobile",
    },
  },
  "zh-CN": {
    color: "颜色",
    expectedPickup: "预计取件",
    label: "标签",
    thankYou: "谢谢惠顾",
    ticket: "工单",
    walkInCustomer: "散客",
    paymentMethods: { cash: "现金", card: "银行卡", app: "移动支付" },
  },
} as const satisfies Record<
  PrintLocale,
  {
    color: string;
    expectedPickup: string;
    label: string;
    thankYou: string;
    ticket: string;
    walkInCustomer: string;
    paymentMethods: Record<PosPaymentTransaction["paymentMethod"], string>;
  }
>;

function formatReceiptPickup(iso: string, locale: PrintLocale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(locale, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
