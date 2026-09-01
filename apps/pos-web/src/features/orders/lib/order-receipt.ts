import type {
  PosBranchSummary,
  PosOrderDetail,
  PosPaymentTransaction,
} from "@cleanhub/api-client";
import { buildPosReceiptText, type PrintLocale } from "@cleanhub/hardware";
import { formatPosOrderCode } from "@cleanhub/domain/order-codes";

import {
  MOBILE_MONEY_PROVIDER_LABELS,
  PAYMENT_METHOD_LABELS,
} from "../constants";

export function buildPosOrderReceipt(input: {
  branch: PosBranchSummary | null;
  locale: string;
  order: PosOrderDetail;
  payments: PosPaymentTransaction[];
}): { content: string; title: string } {
  const { branch, order, payments } = input;
  const items = order.items.map((item) => {
    const quantity =
      item.pricingUnit === "per_kg"
        ? Number(item.weight ?? item.quantity)
        : Number(item.quantity);
    const details = [
      item.pricingUnit === "per_kg"
        ? `${item.weight ?? item.quantity} kg${item.bagCount ? ` / ${item.bagCount}` : ""}`
        : `${item.quantity} × ${item.unitOfMeasure ?? "item"}`,
      item.itemColor ? `Color: ${item.itemColor}` : null,
      item.specialRequest ? item.specialRequest : null,
    ].filter((value): value is string => Boolean(value));
    return {
      name: item.itemName,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      unitAmountMinor: toMinorUnits(item.chargedUnitAmount, order.currency),
      totalAmountMinor: toMinorUnits(item.lineAmount, order.currency),
      note: details.length > 0 ? details.join(" · ") : undefined,
    };
  });
  const totalMinor = toMinorUnits(order.totalAmount, order.currency);
  const paymentMethod = [
    ...new Set(
      payments
        .filter((payment) => payment.paymentStatus === "paid")
        .map((payment) =>
          payment.provider
            ? MOBILE_MONEY_PROVIDER_LABELS[payment.provider]
            : PAYMENT_METHOD_LABELS[payment.paymentMethod],
        ),
    ),
  ].join(" / ");
  const paidCash = payments.filter(
    (payment) =>
      payment.paymentMethod === "cash" && payment.paymentStatus === "paid",
  );
  const title = `RC-${order.id.slice(-8).toUpperCase()}`;
  return {
    title,
    content: buildPosReceiptText(
      {
        receiptNo: title,
        orderCode: formatPosOrderCode(order.id),
        issuedAt: order.paidAt ?? order.updatedAt,
        currency: order.currency,
        merchantName: branch?.receiptName || branch?.name || "CleanHub",
        branchName: branch?.name,
        customerName: order.customerName ?? "Walk-in customer",
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
        taxRegistrationNumber:
          order.taxRegistrationNumberSnapshot ?? undefined,
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
        footer: [branch?.receiptAddress, branch?.receiptPhone, "Thank you"]
          .filter(Boolean)
          .join(" · "),
      },
      { locale: toPrintLocale(input.locale) },
    ),
  };
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
