"use client";

import { useTranslation } from "@cleanhub/i18n/react";
import Link from "next/link";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { posMessage } from "@/lib/pos-message";
import { getOrderStatusLabel } from "@/lib/order-labels";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@cleanhub/ui";

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
  const { locale, t } = useTranslation();
  const { timeZone } = usePosRuntimeConfig();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">关联订单与支付</CardTitle>
      </CardHeader>
      <CardContent>
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
                      {formatTicketDateTime(order.createdAt, locale, timeZone)}
                      {" · "}
                      {t("pos.cart.itemCount", {
                        count: order.ticketItemIds.length,
                      })}
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {getOrderStatusLabel(order.status)}
                  </Badge>
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
                {order.settledTicketCount > 1 ? (
                  <div className="mt-2 rounded-md bg-muted/60 px-2.5 py-2 text-xs leading-5 text-muted-foreground">
                    该订单合并结算了 {order.settledTicketCount} 张工单，上方金额为订单总额。
                    {order.ticketAmount
                      ? posMessage("pos.inline.ticketShareOfOrder", {
                          amount: formatTicketMoney(
                            order.ticketAmount,
                            order.currency,
                          ),
                        })
                      : ""}
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          订单信息仅供参考，详细操作请前往订单管理。{TICKET_EMPTY_PLACEHOLDER}
        </p>
      </CardContent>
    </Card>
  );
}
