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
  PosOrderDetail,
  PosMobileMoneyProvider,
  PosPaymentTransaction,
} from "@cleanhub/api-client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { PosBreadcrumb } from "@/components/app-shell";
import { customerDetailPath, posRoutes } from "@/config";

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
import { OrderInfoEditor } from "./order-info-editor";
import { OrderItemsManager } from "./order-items-manager";

type OrderDetailViewProps = {
  canResolveManualPayments: boolean;
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
  order,
  payments,
  source,
}: OrderDetailViewProps) {
  const breadcrumbItems = buildOrderBreadcrumbItems(order, source);

  return (
    <section>
      <PosBreadcrumb className="mb-5" items={breadcrumbItems} />

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              {displayOrderCode(order.id)}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {order.customerName || "未命名客户"} ·{" "}
              {ORDER_TYPE_LABELS[order.orderType]}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <OrderPaymentStatusBadge status={order.paymentStatus} />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-4">
          <OrderInfoEditor order={order} />
          <OrderItemsManager order={order} />
          <OrderPaymentsCard
            canResolveManualPayments={canResolveManualPayments}
            orderId={order.id}
            payments={payments}
          />
        </div>
        <OrderActionsPanel order={order} payments={payments} />
      </div>
    </section>
  );
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
      { label: "订单详情" },
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
      { label: "订单详情" },
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
      { label: "订单详情" },
    ];
  }

  return [
    { href: posRoutes.tickets, label: "工单管理" },
    { href: ticketHref, label: "工单详情" },
    { label: "订单详情" },
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
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold text-slate-950">支付流水</h2>
        <p className="mt-1 text-xs text-slate-500">
          Wave / Orange Money 需由 Owner 或 Manager 在商户应用核对后确认。
        </p>
      </div>
      {payments.length === 0 ? (
        <div className="px-5 py-8 text-sm text-slate-400">暂无支付流水。</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {payments.map((payment) => (
            <div
              className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 text-sm"
              key={payment.id}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold text-slate-800">
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
                  <div className="mt-1 truncate text-xs text-slate-500">
                    流水号：{payment.externalReference}
                  </div>
                ) : null}
                <div className="mt-1 text-xs text-slate-400">
                  {formatOrderDateTime(
                    payment.paidAt ?? payment.createdAt,
                    locale,
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="font-semibold text-slate-900">
                  {formatOrderMoney(payment.amount, payment.currency)}
                </div>
                {payment.paymentStatus === "pending" ? (
                  canResolveManualPayments ? (
                    <div className="flex gap-2">
                      <button
                        className="h-9 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"
                        onClick={() =>
                          setResolution({ payment, action: "confirm" })
                        }
                        type="button"
                      >
                        确认到账
                      </button>
                      <button
                        className="h-9 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-50"
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
              <div className="rounded-lg bg-slate-50 p-4 text-sm">
                <div className="font-semibold text-slate-900">
                  {getPaymentDisplayName(
                    resolution.payment.paymentMethod,
                    resolution.payment.provider,
                  )} · {formatOrderMoney(
                    resolution.payment.amount,
                    resolution.payment.currency,
                  )}
                </div>
                <div className="mt-1 text-slate-500">
                  流水号：{resolution.payment.externalReference ?? "—"}
                </div>
              </div>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                {resolution.action === "fail" ? "失败原因" : "确认备注（可选）"}
                <textarea
                  className="min-h-24 rounded-lg border border-slate-200 px-3 py-2 font-normal outline-none focus:border-blue-300"
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
                  className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700"
                  disabled={isPending}
                  onClick={closeResolutionDialog}
                  type="button"
                >
                  取消
                </button>
                <button
                  className={`h-10 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50 ${
                    resolution.action === "confirm"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-red-600 hover:bg-red-700"
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
