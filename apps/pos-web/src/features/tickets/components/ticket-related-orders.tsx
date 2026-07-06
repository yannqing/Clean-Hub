"use client";

import { useTranslation } from "@cleanhub/i18n/react";

import {
  formatTicketDateTime,
  formatTicketMoney,
  TICKET_EMPTY_PLACEHOLDER,
} from "../constants";
import type { RelatedOrderSummary } from "@cleanhub/api-client";

type TicketRelatedOrdersProps = {
  orders: RelatedOrderSummary[];
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  received: "待支付",
  paid: "已付款",
  delivered: "已交付",
  cancelled: "已取消",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "未支付",
  paid: "已支付",
  partial: "部分支付",
  refunded: "已退款",
};

/**
 * Side panel listing the orders linked to a ticket. Read-only: creation and
 * payment happen on the orders page. We surface payment status because the
 * ticket pickup transition depends on linked orders being settled.
 */
export function TicketRelatedOrders({ orders }: TicketRelatedOrdersProps) {
  const { locale } = useTranslation();

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-950">关联订单与支付</h2>
      </div>
      {orders.length === 0 ? (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-500">
          该工单暂无关联订单。订单创建后，取件前需确保所有关联订单已结清。
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {orders.map((order) => (
            <div
              className="rounded-lg border border-slate-200 p-3"
              key={order.id}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-sm font-semibold text-slate-950">
                    {order.id.slice(-8).toUpperCase()}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {formatTicketDateTime(order.createdAt, locale)}
                  </div>
                </div>
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {ORDER_STATUS_LABELS[order.status] ?? order.status}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                <span className="text-slate-500">
                  支付：{PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
                </span>
                <span className="font-semibold text-slate-950">
                  {formatTicketMoney(order.paidAmount)} / {formatTicketMoney(order.totalAmount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-slate-400">
        订单信息仅供参考，详细操作请前往订单管理。{TICKET_EMPTY_PLACEHOLDER}
      </p>
    </section>
  );
}
