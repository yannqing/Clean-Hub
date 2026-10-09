"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import type { PosOrderSummary } from "@cleanhub/api-client";

import { useTranslation } from "@cleanhub/i18n/react";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { posToast as toast } from "@/lib/pos-toast";
import { formatPosMoney } from "@/lib/money";
import {
  getOrderPaymentStatusLabel,
  getOrderStatusLabel,
  getOrderTypeLabel,
} from "@/lib/order-labels";

import {
  CUSTOMER_ORDER_PAYMENT_TONES,
  CUSTOMER_ORDER_STATUS_TONES,
} from "../constants";
import { fetchCustomerOrders } from "../queries";

type CustomerOrderListProps = {
  customerId: string;
  /** Max rows per page. */
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

/**
 * Order list scoped to one customer. Mirrors the prototype `orderRows`:
 * header with search, and a grid table (Order / Source / Payment / Status /
 * Amount). Clicking a row navigates to the order detail page.
 */
export function CustomerOrderList({
  customerId,
  pageSize = DEFAULT_PAGE_SIZE,
}: CustomerOrderListProps) {
  const router = useRouter();
  const { locale } = useTranslation();
  const { timeZone } = usePosRuntimeConfig();
  const [rows, setRows] = useState<PosOrderSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);
  const [query, setQuery] = useState("");
  const reloadRequestIdRef = useRef(0);

  const reload = useCallback(async () => {
    const requestId = reloadRequestIdRef.current + 1;
    reloadRequestIdRef.current = requestId;
    setLoading(true);
    try {
      const result = await fetchCustomerOrders(
        customerId,
        page,
        currentPageSize,
        query,
      );
      if (reloadRequestIdRef.current !== requestId) return;
      setRows(result.rows);
      setTotal(result.total);
    } catch (error) {
      if (reloadRequestIdRef.current !== requestId) return;
      toast.error(
        error instanceof Error ? error.message : "加载订单失败，请重试。",
      );
      setRows([]);
      setTotal(0);
    } finally {
      if (reloadRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [customerId, page, currentPageSize, query]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch; setState happens in the async continuation.
    void reload();
  }, [reload]);

  const pageCount = Math.max(1, Math.ceil(total / currentPageSize));
  const from = total === 0 ? 0 : (page - 1) * currentPageSize + 1;
  const to = Math.min(total, (page - 1) * currentPageSize + rows.length);

  return (
    <section className="mt-5 overflow-hidden border-y bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2.5">
        <div>
          <h2 className="font-semibold text-foreground">订单记录</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            仅展示该客户档案名下的订单记录。
          </p>
        </div>
        <div className="flex h-8 w-full items-center rounded-md border bg-background px-2.5 focus-within:ring-2 focus-within:ring-ring sm:w-[300px]">
          <span className="mr-2 text-muted-foreground">⌕</span>
          <input
            className="h-full min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="搜索订单号"
            value={query}
          />
        </div>
      </div>

      <div className="divide-y min-[1400px]:hidden">
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            {loading ? "加载中…" : "没有符合当前条件的订单。"}
          </div>
        ) : (
          rows.map((order) => (
            <CustomerOrderCard
              key={order.id}
              locale={locale}
              onOpen={() => router.push(`/orders/${order.id}`)}
              order={order}
            />
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto min-[1400px]:block">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[130px_1.3fr_140px_140px_130px] bg-muted/50 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <div>订单</div>
            <div>来源</div>
            <div>支付</div>
            <div>状态</div>
            <div className="text-right">金额</div>
          </div>

          {rows.length === 0 ? (
            <div className="border-t px-5 py-10 text-center text-sm text-muted-foreground">
              {loading ? "加载中…" : "没有符合当前条件的订单。"}
            </div>
          ) : (
            rows.map((order) => {
              const statusTone =
                CUSTOMER_ORDER_STATUS_TONES[order.status] ??
                "bg-muted text-muted-foreground";
              const payTone =
                CUSTOMER_ORDER_PAYMENT_TONES[order.paymentStatus] ??
                "bg-muted text-muted-foreground";
              return (
                <button
                  className="grid w-full grid-cols-[130px_1.3fr_140px_140px_130px] items-center border-t px-5 py-4 text-left text-sm transition-colors hover:bg-accent"
                  key={order.id}
                  type="button"
                  onClick={() => router.push(`/orders/${order.id}`)}
                >
                  <div>
                    <div className="font-semibold text-foreground">
                      {order.id.slice(-8).toUpperCase()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(order.createdAt, locale, timeZone)}
                    </div>
                  </div>
                  <div className="text-foreground">
                    {getOrderTypeLabel(order.orderType)}
                  </div>
                  <div>
                    <span
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold ${payTone}`}
                    >
                      {getOrderPaymentStatusLabel(order.paymentStatus)}
                    </span>
                  </div>
                  <div>
                    <span
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold ${statusTone}`}
                    >
                      {getOrderStatusLabel(order.status)}
                    </span>
                  </div>
                  <div className="text-right font-semibold text-foreground">
                    {formatPosMoney(order.totalAmount, order.currency, locale)}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-2.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            第 {from}-{to} 条 / 共 {total} 条
          </span>
          <label className="flex items-center gap-1">
            每页
            <select
              className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={currentPageSize}
              onChange={(event) => {
                setCurrentPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            条
          </label>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="h-9 rounded-md border px-3 text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-40"
            disabled={loading || page === 1}
            type="button"
            onClick={() => setPage((p) => p - 1)}
          >
            上一页
          </button>
          <span className="px-2 text-xs text-muted-foreground">
            {page} / {pageCount}
          </span>
          <button
            className="h-9 rounded-md border px-3 text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-40"
            disabled={loading || page === pageCount}
            type="button"
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </button>
        </div>
      </div>
    </section>
  );
}

function CustomerOrderCard({
  order,
  locale,
  onOpen,
}: {
  order: PosOrderSummary;
  locale: string;
  onOpen: () => void;
}) {
  const { timeZone } = usePosRuntimeConfig();
  const statusTone =
    CUSTOMER_ORDER_STATUS_TONES[order.status] ??
    "bg-muted text-muted-foreground";
  const payTone =
    CUSTOMER_ORDER_PAYMENT_TONES[order.paymentStatus] ??
    "bg-muted text-muted-foreground";

  return (
    <button
      className="w-full p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-5"
      onClick={onOpen}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-sm font-semibold text-foreground">
            {order.id.slice(-8).toUpperCase()}
          </div>
          <div className="mt-1 text-sm font-medium text-foreground">
            {getOrderTypeLabel(order.orderType)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatDate(order.createdAt, locale, timeZone)}
          </div>
        </div>
        <span
          className={`rounded-md px-2.5 py-1 text-xs font-semibold ${statusTone}`}
        >
          {getOrderStatusLabel(order.status)}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-md bg-muted/40 p-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">支付状态</dt>
          <dd className="mt-1">
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${payTone}`}
            >
              {getOrderPaymentStatusLabel(order.paymentStatus)}
            </span>
          </dd>
        </div>
        <CustomerOrderCardDetail
          label="订单金额"
          value={formatPosMoney(order.totalAmount, order.currency, locale)}
        />
        <CustomerOrderCardDetail label="操作" value="查看订单详情" />
      </dl>
    </button>
  );
}

function CustomerOrderCardDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function formatDate(iso: string, locale: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale, {
    month: "2-digit",
    day: "2-digit",
    timeZone,
  });
}
