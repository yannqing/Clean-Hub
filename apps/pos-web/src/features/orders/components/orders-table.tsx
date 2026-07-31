"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { KeyboardEvent } from "react";
import type { PosOrderSummary } from "@cleanhub/api-client";
import type { SupportedLocale } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cleanhub/ui";

import { Icon } from "@/components/app-shell";
import { translatePosText } from "@/components/i18n/pos-runtime-text";
import { posRoutes } from "@/config";

import {
  displayOrderCode,
  formatOrderDateTime,
  formatOrderMoney,
  ORDER_COLUMN_KEYS,
  ORDER_COLUMN_LABELS,
  ORDER_FILTER_KEYS,
  ORDER_TYPE_LABELS,
  type OrderColumnKey,
} from "../constants";
import { OrderPagination } from "./order-pagination";
import { OrderPaymentStatusBadge, OrderStatusBadge } from "./order-badges";

type OrdersTableProps = {
  orders: PosOrderSummary[];
  total: number;
};

export function OrdersTable({ orders, total }: OrdersTableProps) {
  const { locale } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const visibleColumns = parseVisibleColumns(
    params.get(ORDER_FILTER_KEYS.columns),
  );
  const visibleColumnCount = ORDER_COLUMN_KEYS.filter((column) =>
    visibleColumns.has(column),
  ).length;
  const text = (value: string) => translatePosText(value, locale);

  if (orders.length === 0) {
    return <OrdersEmptyState locale={locale} />;
  }

  function openOrder(orderId: string) {
    router.push(posRoutes.orderDetail(orderId));
  }

  function handleRowKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    orderId: string,
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    openOrder(orderId);
  }

  return (
    <section className="min-w-0 overflow-hidden border-y bg-background">
      <div className="divide-y min-[900px]:hidden">
        {orders.map((order) => (
          <OrderCard key={order.id} locale={locale} order={order} />
        ))}
      </div>

      <div className="hidden min-[900px]:block">
        <Table
          className="text-xs [&_td]:px-2 [&_td]:py-2 [&_th]:h-8 [&_th]:px-2"
          style={{
            minWidth: `${Math.max(620, visibleColumnCount * 118)}px`,
          }}
        >
          <TableHeader>
            <TableRow>
              {ORDER_COLUMN_KEYS.map((column) =>
                visibleColumns.has(column) ? (
                  <TableHead key={column}>
                    {text(ORDER_COLUMN_LABELS[column])}
                  </TableHead>
                ) : null,
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow
                className="cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none"
                key={order.id}
                onClick={() => openOrder(order.id)}
                onKeyDown={(event) => handleRowKeyDown(event, order.id)}
                onMouseEnter={() =>
                  router.prefetch(posRoutes.orderDetail(order.id))
                }
                tabIndex={0}
              >
                {visibleColumns.has("order") ? (
                  <TableCell>
                    <span className="block font-mono font-semibold text-foreground">
                      {displayOrderCode(order.id)}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {text(ORDER_TYPE_LABELS[order.orderType])}
                    </span>
                  </TableCell>
                ) : null}
                {visibleColumns.has("customer") ? (
                  <TableCell className="max-w-56">
                    <span className="block truncate font-medium text-foreground">
                      {order.customerName || text("未命名客户")}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {formatOrderItemCount(order.itemCount, locale)}
                    </span>
                  </TableCell>
                ) : null}
                {visibleColumns.has("amount") ? (
                  <TableCell>
                    <span className="block font-medium">
                      {formatOrderMoney(
                        order.totalAmount,
                        order.currency,
                        locale,
                      )}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {text("已收")}{" "}
                      {formatOrderMoney(
                        order.paidAmount,
                        order.currency,
                        locale,
                      )}
                    </span>
                  </TableCell>
                ) : null}
                {visibleColumns.has("status") ? (
                  <TableCell>
                    <OrderStatusBadge status={order.status} />
                  </TableCell>
                ) : null}
                {visibleColumns.has("payment") ? (
                  <TableCell>
                    <OrderPaymentStatusBadge status={order.paymentStatus} />
                  </TableCell>
                ) : null}
                {visibleColumns.has("createdAt") ? (
                  <TableCell className="text-muted-foreground">
                    {formatOrderDateTime(order.createdAt, locale)}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
    <Link
      className="block min-h-24 px-3 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
      href={detailHref}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-xs font-semibold text-foreground">
            {displayOrderCode(order.id)}
          </div>
          <div className="mt-1 truncate text-sm font-medium text-foreground">
            {order.customerName || text("未命名客户")}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {text(ORDER_TYPE_LABELS[order.orderType])} ·{" "}
            {formatOrderItemCount(order.itemCount, locale)}
          </div>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">
            {formatOrderMoney(order.totalAmount, order.currency, locale)}
          </span>
          <OrderPaymentStatusBadge status={order.paymentStatus} />
        </div>
        <span className="flex items-center gap-1 text-muted-foreground">
          {formatOrderDateTime(order.createdAt, locale)}
          <Icon className="size-3.5" name="chevron-right" />
        </span>
      </div>
    </Link>
  );
}

function OrdersEmptyState({ locale }: { locale: SupportedLocale }) {
  const text = (value: string) => translatePosText(value, locale);

  return (
    <section className="border-y bg-background p-4">
      <div className="border-y border-dashed px-4 py-14 text-center">
        <Icon
          className="mx-auto size-5 text-muted-foreground"
          name="search-x"
        />
        <h2 className="mt-3 text-base font-semibold text-foreground">
          {text("没有匹配的订单")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {text("请调整关键词或筛选条件后重试。")}
        </p>
      </div>
    </section>
  );
}

function parseVisibleColumns(value: string | null): Set<OrderColumnKey> {
  if (!value) {
    return new Set(ORDER_COLUMN_KEYS);
  }

  const requested = new Set(value.split(","));
  const visible = ORDER_COLUMN_KEYS.filter((column) => requested.has(column));
  return new Set(visible.length > 0 ? visible : ORDER_COLUMN_KEYS);
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
