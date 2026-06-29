import Link from "next/link";

import { Icon } from "@/components/app-shell";
import { posRoutes } from "@/config";

import {
  displayOrderCode,
  formatOrderDateTime,
  formatOrderMoney,
  ORDER_TYPE_LABELS,
} from "../constants";
import type { PosOrderSummary } from "@cleanhub/api-client";
import { OrderPagination } from "./order-pagination";
import { OrderPaymentStatusBadge, OrderStatusBadge } from "./order-badges";

type OrdersTableProps = {
  orders: PosOrderSummary[];
  total: number;
};

export function OrdersTable({ orders, total }: OrdersTableProps) {
  if (orders.length === 0) {
    return <OrdersEmptyState />;
  }

  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="font-semibold text-slate-950">订单列表</h2>
          <p className="mt-1 text-xs text-slate-500">
            共 {total} 条结果 · 点击订单号或查看按钮打开详情
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[1080px]">
          <div className="grid grid-cols-[150px_minmax(190px,1.2fr)_100px_110px_110px_140px_90px] bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            <div>订单 / 类型</div>
            <div>客户 / 条目</div>
            <div>金额</div>
            <div>订单状态</div>
            <div>支付状态</div>
            <div>创建时间</div>
            <div className="text-right">操作</div>
          </div>
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </div>
      </div>
      <OrderPagination total={total} />
    </section>
  );
}

function OrderRow({ order }: { order: PosOrderSummary }) {
  const detailHref = posRoutes.orderDetail(order.id);

  return (
    <div className="grid grid-cols-[150px_minmax(190px,1.2fr)_100px_110px_110px_140px_90px] items-center border-t border-slate-100 px-5 py-4 text-sm hover:bg-slate-50/70">
      <div className="min-w-0">
        <Link
          className="font-mono text-xs font-semibold text-blue-700 hover:underline"
          href={detailHref}
        >
          {displayOrderCode(order.id)}
        </Link>
        <div className="mt-1 text-[11px] text-slate-400">
          {ORDER_TYPE_LABELS[order.orderType]}
        </div>
      </div>
      <div className="min-w-0">
        <div className="truncate font-semibold text-slate-800">
          {order.customerName || "未命名客户"}
        </div>
        <div className="mt-1 truncate text-xs text-slate-500">
          {order.itemCount} 个条目 · 已收 {formatOrderMoney(order.paidAmount)}
        </div>
      </div>
      <div className="text-xs font-semibold text-slate-700">
        {formatOrderMoney(order.totalAmount)}
      </div>
      <div>
        <OrderStatusBadge status={order.status} />
      </div>
      <div>
        <OrderPaymentStatusBadge status={order.paymentStatus} />
      </div>
      <div className="text-xs font-medium text-slate-600">
        {formatOrderDateTime(order.createdAt)}
      </div>
      <div className="flex justify-end gap-1">
        <Link
          aria-label="查看详情"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-700"
          href={detailHref}
          title="查看详情"
        >
          <Icon className="h-4 w-4" name="eye" />
        </Link>
      </div>
    </div>
  );
}

function OrdersEmptyState() {
  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="px-5 py-14 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
          <Icon className="h-5 w-5" name="search-x" />
        </span>
        <div className="mt-3 font-semibold text-slate-700">没有匹配的订单</div>
        <div className="mt-1 text-sm text-slate-400">
          请调整关键词或筛选条件后重试。
        </div>
      </div>
    </section>
  );
}
