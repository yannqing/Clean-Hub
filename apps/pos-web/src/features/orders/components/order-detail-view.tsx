import Link from "next/link";
import type {
  PosOrderDetail,
  PosPaymentTransaction,
} from "@cleanhub/api-client";

import { Icon } from "@/components/app-shell";
import { posRoutes } from "@/config";

import {
  displayOrderCode,
  formatOrderDateTime,
  formatOrderMoney,
  ORDER_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
} from "../constants";
import { OrderActionsPanel } from "./order-actions-panel";
import { OrderPaymentStatusBadge, OrderStatusBadge } from "./order-badges";
import { OrderInfoEditor } from "./order-info-editor";
import { OrderItemsManager } from "./order-items-manager";

type OrderDetailViewProps = {
  order: PosOrderDetail;
  payments: PosPaymentTransaction[];
};

export function OrderDetailView({ order, payments }: OrderDetailViewProps) {
  return (
    <section>
      <div className="mb-5 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
        <span>POS</span>
        <Icon className="h-3.5 w-3.5" name="chevron-right" />
        <Link className="hover:text-slate-600" href={posRoutes.orders}>
          订单管理
        </Link>
        <Icon className="h-3.5 w-3.5" name="chevron-right" />
        <span className="text-slate-600">{displayOrderCode(order.id)}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-700"
            href={posRoutes.orders}
          >
            <Icon className="h-4 w-4" name="arrow-left" />
            返回订单列表
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            {displayOrderCode(order.id)}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {order.customerName || "未命名客户"} · {ORDER_TYPE_LABELS[order.orderType]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <OrderPaymentStatusBadge status={order.paymentStatus} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-4">
          <OrderInfoEditor order={order} />
          <OrderItemsManager order={order} />
          <OrderPaymentsCard payments={payments} />
        </div>
        <OrderActionsPanel order={order} />
      </div>
    </section>
  );
}

function OrderPaymentsCard({
  payments,
}: {
  payments: PosPaymentTransaction[];
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold text-slate-950">支付流水</h2>
        <p className="mt-1 text-xs text-slate-500">
          本期仅开放现金收款，银行卡和 App 待接入。
        </p>
      </div>
      {payments.length === 0 ? (
        <div className="px-5 py-8 text-sm text-slate-400">暂无支付流水。</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {payments.map((payment) => (
            <div
              className="flex items-center justify-between gap-4 px-5 py-4 text-sm"
              key={payment.id}
            >
              <div>
                <div className="font-semibold text-slate-800">
                  {PAYMENT_METHOD_LABELS[payment.paymentMethod]}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {formatOrderDateTime(payment.paidAt ?? payment.createdAt)}
                </div>
              </div>
              <div className="font-semibold text-slate-900">
                {formatOrderMoney(payment.amount)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
