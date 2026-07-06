"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import type { ServiceTicketItem } from "@cleanhub/api-client";

import { toast } from "@cleanhub/ui";

import {
  CUSTOMER_TICKET_ITEM_STATUS_LABELS,
  CUSTOMER_TICKET_ITEM_STATUS_TONES,
  CUSTOMER_TICKET_ITEM_TYPE_LABELS,
  CUSTOMER_TICKET_TYPE_LABELS,
} from "../constants";
import { fetchCustomerServiceItems } from "../queries";

type CustomerServiceItemListProps = {
  customerId: string;
  /** Max rows per page. */
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

/** A service-item row enriched with its owning ticket's number + type. */
type ServiceItemRow = ServiceTicketItem & {
  ticketNo: string | null;
  ticketType: import("@cleanhub/api-client").ServiceTicketType;
};

const GRID_COLS = "grid-cols-[1.1fr_1fr_1fr_120px_120px]";

/**
 * 服务项目 tab: lists the ticket_items across a customer's recent tickets.
 * Mirrors the prototype `itemRows` (Item / Service / Ticket·notes / Date /
 * Status). The item's owning ticket number links to the ticket detail page.
 */
export function CustomerServiceItemList({
  customerId,
  pageSize = DEFAULT_PAGE_SIZE,
}: CustomerServiceItemListProps) {
  const router = useRouter();
  const [rows, setRows] = useState<ServiceItemRow[]>([]);
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
      const result = await fetchCustomerServiceItems(
        customerId,
        page,
        currentPageSize,
        query,
      );
      if (reloadRequestIdRef.current !== requestId) return;
      setRows(result.items);
      setTotal(result.total);
    } catch (error) {
      if (reloadRequestIdRef.current !== requestId) return;
      toast.error(
        error instanceof Error ? error.message : "加载服务项目失败，请重试。",
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
          <h2 className="font-semibold text-slate-950">服务项目</h2>
          <p className="mt-1 text-sm text-slate-500">
            仅展示该客户档案名下工单的服务项目记录。
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
            placeholder="搜索项目、服务或工单号"
            value={query}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[820px]">
          <div
            className={`grid ${GRID_COLS} bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400`}
          >
            <div>项目</div>
            <div>服务</div>
            <div>工单 / 备注</div>
            <div>日期</div>
            <div>状态</div>
          </div>

          {rows.length === 0 ? (
            <div className="border-t border-slate-100 px-5 py-10 text-center text-sm text-slate-500">
              {loading ? "加载中…" : "没有符合当前条件的服务项目。"}
            </div>
          ) : (
            rows.map((item) => {
              const tone =
                CUSTOMER_TICKET_ITEM_STATUS_TONES[item.itemStatus] ??
                "bg-slate-100 text-slate-600";
              const note =
                item.defectNotes || item.specialRequest || item.remark;
              return (
                <div
                  className={`grid ${GRID_COLS} items-center border-t border-slate-100 px-5 py-4 text-sm`}
                  key={item.id}
                >
                  <div className="font-semibold text-slate-950">
                    {item.itemName}
                    {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                  </div>
                  <div className="text-slate-700">
                    {item.itemCategory ??
                      (item.itemType
                        ? CUSTOMER_TICKET_ITEM_TYPE_LABELS[item.itemType] ??
                          item.itemType
                        : CUSTOMER_TICKET_TYPE_LABELS[item.ticketType] ??
                          item.ticketType)}
                  </div>
                  <div className="min-w-0">
                    <button
                      className="block truncate font-mono text-xs text-blue-700 hover:underline"
                      type="button"
                      onClick={() => router.push(`/tickets/${item.ticketId}`)}
                    >
                      {item.ticketNo || item.ticketId.slice(-8).toUpperCase()}
                    </button>
                    {note ? (
                      <div className="mt-1 truncate text-xs text-slate-500">
                        {note}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-slate-500">{formatDate(item.createdAt)}</div>
                  <div>
                    <span
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold ${tone}`}
                    >
                      {CUSTOMER_TICKET_ITEM_STATUS_LABELS[item.itemStatus] ??
                        item.itemStatus}
                    </span>
                  </div>
                </div>
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

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}
