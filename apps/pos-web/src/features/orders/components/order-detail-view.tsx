"use client";

import { useTranslation } from "@cleanhub/i18n/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@cleanhub/ui";
import type {
  PosCatalogService,
  PosOrderDetail,
  PosMobileMoneyProvider,
  PosPaymentAdjustment,
  PosPaymentTransaction,
} from "@cleanhub/api-client";
import { buildPosReceiptText, type PrintLocale } from "@cleanhub/hardware";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { PosBreadcrumb } from "@/components/app-shell";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { customerDetailPath, posRoutes } from "@/config";
import { PrintJobControl } from "@/features/hardware/components";

import {
  MOBILE_MONEY_PROVIDER_LABELS,
  displayOrderCode,
  formatOrderDateTime,
  formatOrderMoney,
  ORDER_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_TRANSACTION_STATUS_LABELS,
  PAYMENT_TRANSACTION_STATUS_TONES,
} from "../constants";
import {
  confirmManualPaymentAction,
  failManualPaymentAction,
} from "../actions";
import { posToast as toast } from "@/lib/pos-toast";
import { OrderActionsPanel } from "./order-actions-panel";
import { OrderPaymentStatusBadge, OrderStatusBadge } from "./order-badges";
import { OrderDiscountsCard } from "./order-discounts-card";
import { OrderInfoEditor } from "./order-info-editor";
import { OrderItemsManager } from "./order-items-manager";
import { OrderPaymentAdjustments } from "./order-payment-adjustments";

type OrderDetailViewProps = {
  canResolveManualPayments: boolean;
  adjustments: PosPaymentAdjustment[];
  catalog: PosCatalogService[];
  order: PosOrderDetail;
  payments: PosPaymentTransaction[];
  source?: {
    from?: string;
    q?: string;
    ticketFrom?: string;
    ticketId?: string;
  };
};

export function OrderDetailView({
  canResolveManualPayments,
  adjustments,
  catalog,
  order,
  payments,
  source,
}: OrderDetailViewProps) {
  const { locale } = useTranslation();
  const breadcrumbItems = buildOrderBreadcrumbItems(order, source);
  const receiptContent = buildOrderReceiptContent(order, payments, locale);

  return (
    <section className="mx-auto w-full max-w-[1080px] space-y-4 pb-12">
      <PosBreadcrumb items={breadcrumbItems} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-y bg-background px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {order.customerName || "未命名客户"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {ORDER_TYPE_LABELS[order.orderType]} · {displayOrderCode(order.id)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrintJobControl
            canReprint={canResolveManualPayments}
            content={receiptContent}
            documentType="receipt"
            entityId={order.id}
            initialLabel="打印小票"
            title={`RC-${order.id.slice(-8).toUpperCase()}`}
          />
          <OrderStatusBadge status={order.status} />
          <OrderPaymentStatusBadge status={order.paymentStatus} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4">
          <OrderInfoEditor order={order} />
          <OrderItemsManager
            canManageSensitiveOperations={canResolveManualPayments}
            catalog={catalog.filter(
              (service) => service.currency === order.currency,
            )}
            order={order}
          />
          <OrderDiscountsCard
            canManageSensitiveOperations={canResolveManualPayments}
            order={order}
            payments={payments}
          />
          <OrderPaymentsCard
            canResolveManualPayments={canResolveManualPayments}
            orderId={order.id}
            payments={payments}
          />
          <OrderPaymentAdjustments
            adjustments={adjustments}
            canManage={canResolveManualPayments}
            order={order}
            payments={payments}
          />
        </div>
        <OrderActionsPanel
          canManageSensitiveOperations={canResolveManualPayments}
          key={`${order.id}:${order.version}`}
          order={order}
          payments={payments}
        />
      </div>
    </section>
  );
}

function buildOrderReceiptContent(
  order: PosOrderDetail,
  payments: PosPaymentTransaction[],
  locale: string,
): string {
  const items = order.items.map((item) => {
    const quantity =
      item.pricingUnit === "per_kg"
        ? Number(item.weight ?? item.quantity)
        : Number(item.quantity);
    const details = [
      item.pricingUnit === "per_kg"
        ? `计量 ${item.weight ?? item.quantity} kg${item.bagCount ? ` / ${item.bagCount} 袋` : ""}`
        : `计量 ${item.quantity} 件`,
      `成交价 ${formatOrderMoney(item.chargedUnitAmount, order.currency)}`,
      item.standardUnitAmount !== item.chargedUnitAmount
        ? `标准价 ${formatOrderMoney(item.standardUnitAmount, order.currency)}`
        : null,
      item.itemColor ? `颜色 ${item.itemColor}` : null,
      item.defectNotes ? `瑕疵 ${item.defectNotes}` : null,
      item.specialRequest ? `要求 ${item.specialRequest}` : null,
      item.itemIdentifier ? `标识 ${item.itemIdentifier}` : null,
    ].filter((value): value is string => Boolean(value));

    return {
      name: item.itemName,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      unitAmountMinor: toMinorUnits(item.chargedUnitAmount, order.currency),
      totalAmountMinor: toMinorUnits(item.lineAmount, order.currency),
      note: details.length > 0 ? details.join("; ") : undefined,
    };
  });
  const subtotalMinor = toMinorUnits(order.subtotalAmount, order.currency);
  const discountMinor = toMinorUnits(order.discountAmount, order.currency);
  const totalMinor = toMinorUnits(order.totalAmount, order.currency);
  const paymentMethod = [
    ...new Set(
      payments
        .filter((payment) => payment.paymentStatus === "paid")
        .map((payment) =>
          getPaymentDisplayName(payment.paymentMethod, payment.provider),
        ),
    ),
  ].join(" / ");

  return buildPosReceiptText(
    {
      receiptNo: `RC-${order.id.slice(-8).toUpperCase()}`,
      orderCode: displayOrderCode(order.id),
      issuedAt: order.paidAt ?? order.updatedAt,
      currency: order.currency,
      merchantName: "CleanHub",
      customerName: order.customerName,
      items,
      subtotalMinor,
      discountMinor,
      totalMinor,
      paidMinor: toMinorUnits(order.paidAmount, order.currency),
      balanceMinor: Math.max(
        0,
        totalMinor - toMinorUnits(order.paidAmount, order.currency),
      ),
      paymentMethod: paymentMethod || undefined,
      footer: "Thank you",
    },
    { locale: toPrintLocale(locale) },
  );
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

function buildOrderBreadcrumbItems(
  order: PosOrderDetail,
  source: OrderDetailViewProps["source"],
) {
  const ticketId =
    source?.from === "ticket"
      ? (source.ticketId ?? order.items.find((item) => item.ticketId)?.ticketId)
      : null;

  if (!ticketId) {
    return [
      { href: posRoutes.orders, label: "订单管理" },
      { label: displayOrderCode(order.id) },
    ];
  }

  const ticketHref = buildTicketDetailHref(ticketId, source);
  if (source?.ticketFrom === "intake") {
    return [
      { href: buildIntakeReturnPath(source.q), label: "客户接待" },
      {
        href: buildCustomerDetailHref(order.customerId, source),
        label: order.customerName || "客户档案",
      },
      { href: ticketHref, label: "工单详情" },
      { label: displayOrderCode(order.id) },
    ];
  }

  if (source?.ticketFrom === "customer") {
    return [
      { href: posRoutes.customers, label: "客户管理" },
      {
        href: buildCustomerDetailHref(order.customerId, source),
        label: order.customerName || "客户档案",
      },
      { href: ticketHref, label: "工单详情" },
      { label: displayOrderCode(order.id) },
    ];
  }

  return [
    { href: posRoutes.tickets, label: "工单管理" },
    { href: ticketHref, label: "工单详情" },
    { label: displayOrderCode(order.id) },
  ];
}

function buildIntakeReturnPath(query: string | undefined): string {
  const keyword = query?.trim();
  if (!keyword) {
    return posRoutes.newIntake;
  }

  return `${posRoutes.newIntake}?q=${encodeURIComponent(keyword)}`;
}

function buildCustomerDetailHref(
  customerId: string,
  source: OrderDetailViewProps["source"],
): string {
  const base = customerDetailPath(customerId);
  if (source?.ticketFrom !== "intake") {
    return base;
  }

  const params = new URLSearchParams({ from: "intake" });
  const keyword = source.q?.trim();
  if (keyword) {
    params.set("q", keyword);
  }

  return `${base}?${params.toString()}`;
}

function buildTicketDetailHref(
  ticketId: string,
  source: OrderDetailViewProps["source"],
): string {
  const base = posRoutes.ticketDetail(ticketId);
  if (source?.ticketFrom !== "intake" && source?.ticketFrom !== "customer") {
    return base;
  }

  const params = new URLSearchParams({ from: source.ticketFrom });
  const keyword = source.q?.trim();
  if (source.ticketFrom === "intake" && keyword) {
    params.set("q", keyword);
  }

  return `${base}?${params.toString()}`;
}

function OrderPaymentsCard({
  canResolveManualPayments,
  orderId,
  payments,
}: {
  canResolveManualPayments: boolean;
  orderId: string;
  payments: PosPaymentTransaction[];
}) {
  const { locale } = useTranslation();
  const { timeZone } = usePosRuntimeConfig();
  const router = useRouter();
  const [resolution, setResolution] = useState<{
    payment: PosPaymentTransaction;
    action: "confirm" | "fail";
  } | null>(null);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function closeResolutionDialog() {
    if (isPending) return;
    setResolution(null);
    setReason("");
  }

  function submitResolution() {
    if (!resolution) return;
    const trimmedReason = reason.trim();
    if (resolution.action === "fail" && trimmedReason.length < 3) {
      toast.error("标记失败时必须填写原因。");
      return;
    }

    startTransition(async () => {
      const result =
        resolution.action === "confirm"
          ? await confirmManualPaymentAction(orderId, resolution.payment.id, {
              reason: trimmedReason || undefined,
            })
          : await failManualPaymentAction(orderId, resolution.payment.id, {
              reason: trimmedReason,
            });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(
        resolution.action === "confirm"
          ? "移动支付已确认到账。"
          : "移动支付已标记为失败。",
      );
      setResolution(null);
      setReason("");
      router.refresh();
    });
  }

  return (
    <section className="overflow-hidden border-y bg-background">
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold text-foreground">支付流水</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Wave / Orange Money 需由 Owner 或 Manager 在商户应用核对后确认。
        </p>
      </div>
      {payments.length === 0 ? (
        <div className="px-5 py-8 text-sm text-muted-foreground">
          暂无支付流水。
        </div>
      ) : (
        <div className="divide-y">
          {payments.map((payment) => (
            <div
              className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 text-sm"
              key={payment.id}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold text-foreground">
                    {getPaymentDisplayName(
                      payment.paymentMethod,
                      payment.provider,
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PAYMENT_TRANSACTION_STATUS_TONES[payment.paymentStatus]}`}
                  >
                    {PAYMENT_TRANSACTION_STATUS_LABELS[payment.paymentStatus]}
                  </span>
                </div>
                {payment.externalReference ? (
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    流水号：{payment.externalReference}
                  </div>
                ) : null}
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatOrderDateTime(
                    payment.paidAt ?? payment.createdAt,
                    locale,
                    timeZone,
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="font-semibold text-foreground">
                  {formatOrderMoney(payment.amount, payment.currency)}
                </div>
                {payment.paymentStatus === "pending" ? (
                  canResolveManualPayments ? (
                    <div className="flex gap-2">
                      <button
                        className="h-9 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                        onClick={() =>
                          setResolution({ payment, action: "confirm" })
                        }
                        type="button"
                      >
                        确认到账
                      </button>
                      <button
                        className="h-9 rounded-md border border-destructive/30 px-3 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
                        onClick={() =>
                          setResolution({ payment, action: "fail" })
                        }
                        type="button"
                      >
                        标记失败
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-amber-700">
                      等待 Manager 确认
                    </span>
                  )
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog
        onOpenChange={(open) => {
          if (!open) closeResolutionDialog();
        }}
        open={resolution !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resolution?.action === "confirm"
                ? "确认移动支付到账"
                : "标记移动支付失败"}
            </DialogTitle>
            <DialogDescription>
              请先在对应商户应用中核对金额与交易流水号。本操作会记录操作者和时间。
            </DialogDescription>
          </DialogHeader>
          {resolution ? (
            <div className="grid gap-4">
              <div className="rounded-md bg-muted/50 p-4 text-sm">
                <div className="font-semibold text-foreground">
                  {getPaymentDisplayName(
                    resolution.payment.paymentMethod,
                    resolution.payment.provider,
                  )}{" "}
                  ·{" "}
                  {formatOrderMoney(
                    resolution.payment.amount,
                    resolution.payment.currency,
                  )}
                </div>
                <div className="mt-1 text-muted-foreground">
                  流水号：{resolution.payment.externalReference ?? "—"}
                </div>
              </div>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                {resolution.action === "fail" ? "失败原因" : "确认备注（可选）"}
                <textarea
                  className="min-h-24 rounded-md border bg-background px-3 py-2 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={isPending}
                  maxLength={500}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={
                    resolution.action === "fail"
                      ? "例如：商户应用中未找到该笔交易"
                      : "例如：已在 Wave 商户应用核对到账"
                  }
                  value={reason}
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  className="h-11 rounded-md border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
                  disabled={isPending}
                  onClick={closeResolutionDialog}
                  type="button"
                >
                  取消
                </button>
                <button
                  className={`h-11 rounded-md px-4 text-sm font-semibold text-white disabled:opacity-50 ${
                    resolution.action === "confirm"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  }`}
                  disabled={isPending}
                  onClick={submitResolution}
                  type="button"
                >
                  {isPending
                    ? "处理中…"
                    : resolution.action === "confirm"
                      ? "确认已到账"
                      : "确认标记失败"}
                </button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function getPaymentDisplayName(
  paymentMethod: PosPaymentTransaction["paymentMethod"],
  provider: PosMobileMoneyProvider | null,
): string {
  return provider
    ? MOBILE_MONEY_PROVIDER_LABELS[provider]
    : PAYMENT_METHOD_LABELS[paymentMethod];
}
