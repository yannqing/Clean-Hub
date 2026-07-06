"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import type { PosOrderSummary } from "@cleanhub/api-client";

import { toast } from "@cleanhub/ui";

import {
  CUSTOMER_CURRENCY,
  CUSTOMER_ORDER_PAYMENT_LABELS,
  CUSTOMER_ORDER_PAYMENT_TONES,
  CUSTOMER_ORDER_STATUS_LABELS,
  CUSTOMER_ORDER_STATUS_TONES,
  CUSTOMER_ORDER_TYPE_LABELS,
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
    <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between border-b border-slate-200 p-5">
        <div>
          <h2 className="font-semibold text-slate-950">订单记录</h2>
          <p className="mt-1 text-sm text-slate-500">
            仅展示该客户档案名下的订单记录。
          </p>
        </div>
        <div className="flex h-10 w-[300px] items-center rounded-lg border border-slate-200 bg-slate-50 px-3">
          <span className="mr-2 text-slate-400">🔍</span>
          <input
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="搜索订单号"
            value={query}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[130px_1.3fr_140px_140px_130px] bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            <div>订单</div>
            <div>来源</div>
            <div>支付</div>
            <div>状态</div>
            <div className="text-right">金额</div>
          </div>

          {rows.length === 0 ? (
            <div className="border-t border-slate-100 px-5 py-10 text-center text-sm text-slate-500">
              {loading ? "加载中…" : "没有符合当前条件的订单。"}
            </div>
          ) : (
            rows.map((order) => {
              const statusTone =
                CUSTOMER_ORDER_STATUS_TONES[order.status] ??
                "bg-slate-100 text-slate-600";
              const payTone =
                CUSTOMER_ORDER_PAYMENT_TONES[order.paymentStatus] ??
                "bg-slate-100 text-slate-600";
              return (
                <button
                  className="grid w-full grid-cols-[130px_1.3fr_140px_140px_130px] items-center border-t border-slate-100 px-5 py-4 text-left text-sm transition hover:bg-blue-50/40"
                  key={order.id}
                  type="button"
                  onClick={() => router.push(`/orders/${order.id}`)}
                >
                  <div>
                    <div className="font-semibold text-blue-700">
                      {order.id.slice(-8).toUpperCase()}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatDate(order.createdAt)}
                    </div>
                  </div>
                  <div className="text-slate-700">
                    {CUSTOMER_ORDER_TYPE_LABELS[order.orderType] ?? order.orderType}
                  </div>
                  <div>
                    <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${payTone}`}>
                      {CUSTOMER_ORDER_PAYMENT_LABELS[order.paymentStatus] ??
                        order.paymentStatus}
                    </span>
                  </div>
                  <div>
                    <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${statusTone}`}>
                      {CUSTOMER_ORDER_STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </div>
                  <div className="text-right font-semibold text-slate-950">
                    {formatMoney(order.totalAmount)}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>
            第 {from}-{to} 条 / 共 {total} 条
          </span>
          <label className="flex items-center gap-1">
            每页
            <select
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs outline-none"
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
            className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-semibold disabled:opacity-40"
            disabled={loading || page === 1}
            type="button"
            onClick={() => setPage((p) => p - 1)}
          >
            上一页
          </button>
          <span className="px-2 text-xs text-slate-500">
            {page} / {pageCount}
          </span>
          <button
            className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-semibold disabled:opacity-40"
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

function formatMoney(amount: string | number | null | undefined): string {
  const value = Number(amount ?? 0);
  if (!Number.isFinite(value)) return `${CUSTOMER_CURRENCY} 0`;
  return `${CUSTOMER_CURRENCY} ${value.toLocaleString("en-US")}`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}
