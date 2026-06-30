"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import type { ServiceTicketSummary } from "@cleanhub/api-client";

import { toast } from "@cleanhub/ui";

import {
  CUSTOMER_TICKET_STATUS_LABELS,
  CUSTOMER_TICKET_STATUS_TONES,
  CUSTOMER_TICKET_TYPE_LABELS,
} from "../constants";
import { fetchCustomerTickets } from "../queries";

type CustomerTicketListProps = {
  customerId: string;
  /** Max rows per page. */
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 10;

const SERVICE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "all", label: "全部业务类型" },
  { value: "laundry", label: "洗衣护理" },
  { value: "car_wash", label: "车辆清洗" },
  { value: "retail", label: "零售" },
  { value: "delivery", label: "配送" },
];

/**
 * Service-ticket list scoped to one customer. Mirrors the prototype
 * `ticketHistorySection`: header with search + service-type + date filters,
 * and a grid table (Ticket / Service / Items / Status / Expected pickup).
 * Clicking a row navigates to the ticket detail page.
 */
export function CustomerTicketList({
  customerId,
  pageSize = DEFAULT_PAGE_SIZE,
}: CustomerTicketListProps) {
  const router = useRouter();
  const [rows, setRows] = useState<ServiceTicketSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch a generous page so client-side filtering has enough rows to work
      // with (the prototype filters in-memory).
      const result = await fetchCustomerTickets(customerId, 1, 100);
      setRows(result.rows);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "加载工单失败，请重试。",
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch; setState happens in the async continuation.
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((ticket) => {
      const queryMatches =
        !q ||
        [ticket.ticketNo, ticket.ticketType, ticket.customerName]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(q));
      const serviceMatches =
        serviceFilter === "all" || ticket.ticketType === serviceFilter;
      const dateMatches = matchesDateFilter(ticket, dateFilter);
      return queryMatches && serviceMatches && dateMatches;
    });
  }, [rows, query, serviceFilter, dateFilter]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5">
        <div>
          <h2 className="font-semibold text-slate-950">历史工单</h2>
          <p className="mt-1 text-sm text-slate-500">
            仅展示该客户档案名下的工单记录。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-10 w-[240px] items-center rounded-lg border border-slate-200 bg-slate-50 px-3">
            <span className="mr-2 text-slate-400">🔍</span>
            <input
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="搜索工单号或业务类型"
              value={query}
            />
          </div>
          <select
            className="h-10 min-w-[150px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
            onChange={(event) => {
              setServiceFilter(event.target.value);
              setPage(1);
            }}
            value={serviceFilter}
          >
            {SERVICE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="h-10 min-w-[130px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
            onChange={(event) => {
              setDateFilter(event.target.value);
              setPage(1);
            }}
            value={dateFilter}
          >
            <option value="all">全部时间</option>
            <option value="today">今天</option>
            <option value="7d">近 7 天</option>
            <option value="30d">近 30 天</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[1.2fr_1.1fr_90px_130px_150px] bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            <div>工单</div>
            <div>业务类型</div>
            <div>项目数</div>
            <div>状态</div>
            <div>预计取件</div>
          </div>

          {pageRows.length === 0 ? (
            <div className="border-t border-slate-100 px-5 py-10 text-center text-sm text-slate-500">
              {loading ? "加载中…" : "没有符合当前筛选条件的工单。"}
            </div>
          ) : (
            pageRows.map((ticket) => {
              const tone =
                CUSTOMER_TICKET_STATUS_TONES[ticket.ticketStatus] ??
                "bg-slate-100 text-slate-600";
              return (
                <button
                  className="grid w-full grid-cols-[1.2fr_1.1fr_90px_130px_150px] items-center border-t border-slate-100 px-5 py-4 text-left text-sm transition hover:bg-blue-50/40"
                  key={ticket.id}
                  type="button"
                  onClick={() => router.push(`/tickets/${ticket.id}`)}
                >
                  <div>
                    <div className="font-mono text-xs font-semibold text-blue-700">
                      {ticket.ticketNo || "—"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatDate(ticket.createdAt)}
                    </div>
                  </div>
                  <div className="font-medium text-slate-700">
                    {CUSTOMER_TICKET_TYPE_LABELS[ticket.ticketType] ??
                      ticket.ticketType}
                  </div>
                  <div className="text-slate-500">{ticket.itemCount}</div>
                  <div>
                    <span
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold ${tone}`}
                    >
                      {CUSTOMER_TICKET_STATUS_LABELS[ticket.ticketStatus] ??
                        ticket.ticketStatus}
                    </span>
                  </div>
                  <div className="text-slate-500">
                    {ticket.expectedPickupAt ? formatDate(ticket.expectedPickupAt) : "未设置"}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex items-center justify-end border-t border-slate-200 px-5 py-4">
        <div className="flex items-center gap-1">
          <button
            className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-semibold disabled:opacity-40"
            disabled={page === 1}
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
            disabled={page === pageCount}
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

function matchesDateFilter(
  ticket: ServiceTicketSummary,
  filter: string,
): boolean {
  if (filter === "all") return true;
  const created = new Date(ticket.createdAt);
  if (Number.isNaN(created.getTime())) return false;
  const now = new Date();
  const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
  if (filter === "today") return diffDays < 1;
  if (filter === "7d") return diffDays < 7;
  if (filter === "30d") return diffDays < 30;
  return true;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
