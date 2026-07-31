"use client";

import { useTranslation } from "@cleanhub/i18n/react";
import Link from "next/link";

import {
  formatTicketDateTime,
  formatTicketMoney,
  TICKET_EMPTY_PLACEHOLDER,
} from "../constants";
import type { RelatedOrderSummary } from "@cleanhub/api-client";

type TicketRelatedOrdersProps = {
  orderDetailHref?: (orderId: string) => string;
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
export function TicketRelatedOrders({
  orderDetailHref,
  orders,
}: TicketRelatedOrdersProps) {
  const { locale } = useTranslation();

  return (
    <section className="border-y bg-background p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">关联订单与支付</h2>
      </div>
      {orders.length === 0 ? (
        <p className="mt-4 rounded-md bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
          该工单暂无关联订单。订单创建后，取件前需确保所有关联订单已结清。
        </p>
      ) : (
        <div className="mt-4 divide-y">
          {orders.map((order) => (
            <Link
              className="block py-3 transition-colors hover:bg-accent"
              href={orderDetailHref?.(order.id) ?? `/orders/${order.id}`}
              key={order.id}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-sm font-semibold text-foreground">
                    {order.id.slice(-8).toUpperCase()}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatTicketDateTime(order.createdAt, locale)}
                  </div>
                </div>
                <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  {ORDER_STATUS_LABELS[order.status] ?? order.status}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
                <span className="text-muted-foreground">
                  支付：
                  {PAYMENT_STATUS_LABELS[order.paymentStatus] ??
                    order.paymentStatus}
                </span>
                <span className="font-semibold text-foreground">
                  {formatTicketMoney(order.paidAmount, order.currency)} /{" "}
                  {formatTicketMoney(order.totalAmount, order.currency)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        订单信息仅供参考，详细操作请前往订单管理。{TICKET_EMPTY_PLACEHOLDER}
      </p>
    </section>
  );
}
