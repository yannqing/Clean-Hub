"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import type {
  ServiceTicketSummary,
  ServiceTicketType,
} from "@cleanhub/api-client";

import { useTranslation } from "@cleanhub/i18n/react";
import { posToast as toast } from "@/lib/pos-toast";

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
  ticketDetailHref?: (ticketId: string) => string;
};

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

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
  ticketDetailHref,
}: CustomerTicketListProps) {
  const router = useRouter();
  const { locale } = useTranslation();
  const [rows, setRows] = useState<ServiceTicketSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);
  const [query, setQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const reloadRequestIdRef = useRef(0);

  const reload = useCallback(async () => {
    const requestId = reloadRequestIdRef.current + 1;
    reloadRequestIdRef.current = requestId;
    setLoading(true);
    try {
      const dateRange = getCreatedDateRange(dateFilter);
      const result = await fetchCustomerTickets(
        customerId,
        page,
        currentPageSize,
        {
          q: query,
          ticketType:
            serviceFilter === "all"
              ? undefined
              : (serviceFilter as ServiceTicketType),
          createdAfter: dateRange.createdAfter,
          createdBefore: dateRange.createdBefore,
        },
      );
      if (reloadRequestIdRef.current !== requestId) return;
      setRows(result.rows);
      setTotal(result.total);
    } catch (error) {
      if (reloadRequestIdRef.current !== requestId) return;
      toast.error(
        error instanceof Error ? error.message : "加载工单失败，请重试。",
      );
      setRows([]);
      setTotal(0);
    } finally {
      if (reloadRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [customerId, page, currentPageSize, query, serviceFilter, dateFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch; setState happens in the async continuation.
    void reload();
  }, [reload]);

  const pageCount = Math.max(1, Math.ceil(total / currentPageSize));
  const from = total === 0 ? 0 : (page - 1) * currentPageSize + 1;
  const to = Math.min(total, (page - 1) * currentPageSize + rows.length);

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

      <div className="divide-y divide-slate-100 min-[1400px]:hidden">
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            {loading ? "加载中…" : "没有符合当前筛选条件的工单。"}
          </div>
        ) : (
          rows.map((ticket) => (
            <CustomerTicketCard
              href={ticketDetailHref?.(ticket.id) ?? `/tickets/${ticket.id}`}
              key={ticket.id}
              locale={locale}
              onOpen={(href) => router.push(href)}
              ticket={ticket}
            />
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto min-[1400px]:block">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[1.2fr_1.1fr_90px_130px_150px] bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            <div>工单</div>
            <div>业务类型</div>
            <div>项目数</div>
            <div>状态</div>
            <div>预计取件</div>
          </div>

          {rows.length === 0 ? (
            <div className="border-t border-slate-100 px-5 py-10 text-center text-sm text-slate-500">
              {loading ? "加载中…" : "没有符合当前筛选条件的工单。"}
            </div>
          ) : (
            rows.map((ticket) => {
              const tone =
                CUSTOMER_TICKET_STATUS_TONES[ticket.ticketStatus] ??
                "bg-slate-100 text-slate-600";
              return (
                <button
                  className="grid w-full grid-cols-[1.2fr_1.1fr_90px_130px_150px] items-center border-t border-slate-100 px-5 py-4 text-left text-sm transition hover:bg-blue-50/40"
                  key={ticket.id}
                  type="button"
                  onClick={() =>
                    router.push(
                      ticketDetailHref?.(ticket.id) ?? `/tickets/${ticket.id}`,
                    )
                  }
                >
                  <div>
                    <div className="font-mono text-xs font-semibold text-blue-700">
                      {ticket.ticketNo || "—"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatDate(ticket.createdAt, locale)}
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
                    {ticket.expectedPickupAt
                      ? formatDate(ticket.expectedPickupAt, locale)
                      : "未设置"}
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
              className="h-10 rounded-md border border-slate-200 bg-white px-2 text-xs outline-none"
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
            className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold disabled:opacity-40"
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
            className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold disabled:opacity-40"
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

function CustomerTicketCard({
  ticket,
  locale,
  href,
  onOpen,
}: {
  ticket: ServiceTicketSummary;
  locale: string;
  href: string;
  onOpen: (href: string) => void;
}) {
  const tone =
    CUSTOMER_TICKET_STATUS_TONES[ticket.ticketStatus] ??
    "bg-slate-100 text-slate-600";

  return (
    <button
      className="w-full p-4 text-left transition hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:p-5"
      onClick={() => onOpen(href)}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-sm font-semibold text-blue-700">
            {ticket.ticketNo || "—"}
          </div>
          <div className="mt-1 text-sm font-medium text-slate-800">
            {CUSTOMER_TICKET_TYPE_LABELS[ticket.ticketType] ??
              ticket.ticketType}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {formatDate(ticket.createdAt, locale)}
          </div>
        </div>
        <span
          className={`rounded-md px-2.5 py-1 text-xs font-semibold ${tone}`}
        >
          {CUSTOMER_TICKET_STATUS_LABELS[ticket.ticketStatus] ??
            ticket.ticketStatus}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">
        <CustomerTicketCardDetail
          label="项目数"
          value={String(ticket.itemCount)}
        />
        <CustomerTicketCardDetail
          label="预计取件"
          value={
            ticket.expectedPickupAt
              ? formatDate(ticket.expectedPickupAt, locale)
              : "未设置"
          }
        />
        <CustomerTicketCardDetail label="操作" value="查看工单详情" />
      </dl>
    </button>
  );
}

function CustomerTicketCardDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-700">{value}</dd>
    </div>
  );
}

function getCreatedDateRange(filter: string): {
  createdAfter?: string;
  createdBefore?: string;
} {
  if (filter === "all") return {};

  const end = new Date();
  const start = new Date(end);

  if (filter === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (filter === "7d") {
    start.setDate(start.getDate() - 7);
  } else if (filter === "30d") {
    start.setDate(start.getDate() - 30);
  } else {
    return {};
  }

  return {
    createdAfter: start.toISOString(),
    createdBefore: end.toISOString(),
  };
}

function formatDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
