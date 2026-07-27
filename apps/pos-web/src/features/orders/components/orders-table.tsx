"use client";

import Link from "next/link";
import type { SupportedLocale } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";

import { Icon } from "@/components/app-shell";
import { translatePosText } from "@/components/i18n/pos-runtime-text";
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
  const { locale } = useTranslation();
  const text = (value: string) => translatePosText(value, locale);

  if (orders.length === 0) {
    return <OrdersEmptyState locale={locale} />;
  }

  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="font-semibold text-slate-950">{text("订单列表")}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {text("共")} {total} {text("条结果 · 点击订单号或查看按钮打开详情")}
          </p>
        </div>
      </div>

      <div className="divide-y divide-slate-100 min-[1400px]:hidden">
        {orders.map((order) => (
          <OrderCard key={order.id} locale={locale} order={order} />
        ))}
      </div>

      <div className="hidden overflow-x-auto min-[1400px]:block">
        <div className="min-w-[1080px]">
          <div className="grid grid-cols-[150px_minmax(190px,1.2fr)_100px_110px_110px_140px_90px] bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            <div>{text("订单 / 类型")}</div>
            <div>{text("客户 / 条目")}</div>
            <div>{text("金额")}</div>
            <div>{text("订单状态")}</div>
            <div>{text("支付状态")}</div>
            <div>{text("创建时间")}</div>
            <div className="text-right">{text("操作")}</div>
          </div>
          {orders.map((order) => (
            <OrderRow key={order.id} locale={locale} order={order} />
          ))}
        </div>
      </div>
      <OrderPagination total={total} />
    </section>
  );
}

function OrderCard({
  locale,
  order,
}: {
  locale: SupportedLocale;
  order: PosOrderSummary;
}) {
  const detailHref = posRoutes.orderDetail(order.id);
  const text = (value: string) => translatePosText(value, locale);

  return (
    <article className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            className="inline-flex min-h-11 items-center font-mono text-sm font-semibold text-blue-700"
            href={detailHref}
          >
            {displayOrderCode(order.id)}
          </Link>
          <div className="truncate text-base font-semibold text-slate-900">
            {order.customerName ? (
              <RawText value={order.customerName} />
            ) : (
              text("未命名客户")
            )}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {text(ORDER_TYPE_LABELS[order.orderType])} ·{" "}
            {formatOrderItemCount(order.itemCount, locale)}
          </div>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">
        <OrderCardDetail
          label={text("订单金额")}
          value={formatOrderMoney(order.totalAmount, order.currency)}
        />
        <div>
          <dt className="text-xs text-slate-400">{text("支付状态")}</dt>
          <dd className="mt-1">
            <OrderPaymentStatusBadge status={order.paymentStatus} />
          </dd>
        </div>
        <OrderCardDetail
          label={text("创建时间")}
          value={formatOrderDateTime(order.createdAt, locale)}
        />
      </dl>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">{text("已收金额")}</div>
          <div className="mt-0.5 font-semibold text-slate-950">
            {formatOrderMoney(order.paidAmount, order.currency)}
          </div>
        </div>
        <Link
          className="flex h-11 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700"
          href={detailHref}
        >
          <Icon className="h-4 w-4" name="eye" />
          {text("查看详情")}
        </Link>
      </div>
    </article>
  );
}

function OrderCardDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-700">{value}</dd>
    </div>
  );
}

function OrderRow({
  locale,
  order,
}: {
  locale: SupportedLocale;
  order: PosOrderSummary;
}) {
  const detailHref = posRoutes.orderDetail(order.id);
  const text = (value: string) => translatePosText(value, locale);

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
          {text(ORDER_TYPE_LABELS[order.orderType])}
        </div>
      </div>
      <div className="min-w-0">
        <div className="truncate font-semibold text-slate-800">
          {order.customerName ? (
            <RawText value={order.customerName} />
          ) : (
            text("未命名客户")
          )}
        </div>
        <div className="mt-1 truncate text-xs text-slate-500">
          {formatOrderItemCount(order.itemCount, locale)} · {text("已收")}{" "}
          {formatOrderMoney(order.paidAmount, order.currency)}
        </div>
      </div>
      <div className="text-xs font-semibold text-slate-700">
        {formatOrderMoney(order.totalAmount, order.currency)}
      </div>
      <div>
        <OrderStatusBadge status={order.status} />
      </div>
      <div>
        <OrderPaymentStatusBadge status={order.paymentStatus} />
      </div>
      <div className="text-xs font-medium text-slate-600">
        {formatOrderDateTime(order.createdAt, locale)}
      </div>
      <div className="flex justify-end gap-1">
        <Link
          aria-label={text("查看详情")}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-700"
          href={detailHref}
          title={text("查看详情")}
        >
          <Icon className="h-4 w-4" name="eye" />
        </Link>
      </div>
    </div>
  );
}

function OrdersEmptyState({ locale }: { locale: SupportedLocale }) {
  const text = (value: string) => translatePosText(value, locale);

  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="px-5 py-14 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
          <Icon className="h-5 w-5" name="search-x" />
        </span>
        <div className="mt-3 font-semibold text-slate-700">
          {text("没有匹配的订单")}
        </div>
        <div className="mt-1 text-sm text-slate-400">
          {text("请调整关键词或筛选条件后重试。")}
        </div>
      </div>
    </section>
  );
}

function RawText({ value }: { value: string }) {
  return value;
}

function formatOrderItemCount(count: number, locale: SupportedLocale): string {
  if (locale === "en") {
    return `${count} ${count === 1 ? "item" : "items"}`;
  }
  if (locale === "fr") {
    return `${count} article${count === 1 ? "" : "s"}`;
  }
  return `${count} 个条目`;
}
