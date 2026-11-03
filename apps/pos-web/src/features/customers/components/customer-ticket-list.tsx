"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import type {
  ServiceTicketSummary,
  ServiceTicketType,
} from "@cleanhub/api-client";

import { useTranslation } from "@cleanhub/i18n/react";
import {
  addCalendarDays,
  calendarDateStartToUtc,
  getDateOnlyInTimeZone,
} from "@cleanhub/domain/timezone";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { posToast as toast } from "@/lib/pos-toast";

import {
  getTicketStatusLabel,
  getTicketTypeLabel,
} from "@/lib/ticket-labels";

import { CUSTOMER_TICKET_STATUS_TONES } from "../constants";
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
  const { timeZone } = usePosRuntimeConfig();
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
      const dateRange = getCreatedDateRange(dateFilter, timeZone);
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
  }, [
    customerId,
    page,
    currentPageSize,
    query,
    serviceFilter,
    dateFilter,
    timeZone,
  ]);

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
          <h2 className="font-semibold text-foreground">历史工单</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            仅展示该客户档案名下的工单记录。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-8 w-[240px] items-center rounded-md border bg-background px-2.5 focus-within:ring-2 focus-within:ring-ring">
            <span className="mr-2 text-muted-foreground">⌕</span>
            <input
              className="h-full min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="搜索工单号或业务类型"
              value={query}
            />
          </div>
          <select
            className="h-8 min-w-[150px] rounded-md border bg-background px-2.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            className="h-8 min-w-[130px] rounded-md border bg-background px-2.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

      <div className="divide-y min-[1400px]:hidden">
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
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
          <div className="grid grid-cols-[1.2fr_1.1fr_90px_130px_150px] bg-muted/50 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <div>工单</div>
            <div>业务类型</div>
            <div>项目数</div>
            <div>状态</div>
            <div>预计取件</div>
          </div>

          {rows.length === 0 ? (
            <div className="border-t px-5 py-10 text-center text-sm text-muted-foreground">
              {loading ? "加载中…" : "没有符合当前筛选条件的工单。"}
            </div>
          ) : (
            rows.map((ticket) => {
              const tone =
                CUSTOMER_TICKET_STATUS_TONES[ticket.ticketStatus] ??
                "bg-muted text-muted-foreground";
              return (
                <button
                  className="grid w-full grid-cols-[1.2fr_1.1fr_90px_130px_150px] items-center border-t px-5 py-4 text-left text-sm transition-colors hover:bg-accent"
                  key={ticket.id}
                  type="button"
                  onClick={() =>
                    router.push(
                      ticketDetailHref?.(ticket.id) ?? `/tickets/${ticket.id}`,
                    )
                  }
                >
                  <div>
                    <div className="font-mono text-xs font-semibold text-foreground">
                      {ticket.ticketNo || "—"}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDate(ticket.createdAt, locale, timeZone)}
                    </div>
                  </div>
                  <div className="font-medium text-foreground">
                    {getTicketTypeLabel(ticket.ticketType)}
                  </div>
                  <div className="text-muted-foreground">
                    {ticket.itemCount}
                  </div>
                  <div>
                    <span
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold ${tone}`}
                    >
                      {getTicketStatusLabel(ticket.ticketStatus)}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    {ticket.expectedPickupAt
                      ? formatDate(ticket.expectedPickupAt, locale, timeZone)
                      : "未设置"}
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
  const { timeZone } = usePosRuntimeConfig();
  const tone =
    CUSTOMER_TICKET_STATUS_TONES[ticket.ticketStatus] ??
    "bg-muted text-muted-foreground";

  return (
    <button
      className="w-full p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-5"
      onClick={() => onOpen(href)}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-sm font-semibold text-foreground">
            {ticket.ticketNo || "—"}
          </div>
          <div className="mt-1 text-sm font-medium text-foreground">
            {getTicketTypeLabel(ticket.ticketType)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatDate(ticket.createdAt, locale, timeZone)}
          </div>
        </div>
        <span
          className={`rounded-md px-2.5 py-1 text-xs font-semibold ${tone}`}
        >
          {getTicketStatusLabel(ticket.ticketStatus)}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-md bg-muted/40 p-3 sm:grid-cols-3">
        <CustomerTicketCardDetail
          label="项目数"
          value={String(ticket.itemCount)}
        />
        <CustomerTicketCardDetail
          label="预计取件"
          value={
            ticket.expectedPickupAt
              ? formatDate(ticket.expectedPickupAt, locale, timeZone)
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
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function getCreatedDateRange(filter: string, timeZone: string): {
  createdAfter?: string;
  createdBefore?: string;
} {
  if (filter === "all") return {};

  const end = new Date();
  const today = getDateOnlyInTimeZone(end, timeZone);
  let startDate: string;

  if (filter === "today") {
    startDate = today;
  } else if (filter === "7d") {
    startDate = addCalendarDays(today, -7);
  } else if (filter === "30d") {
    startDate = addCalendarDays(today, -30);
  } else {
    return {};
  }

  return {
    createdAfter: calendarDateStartToUtc(startDate, timeZone).toISOString(),
    createdBefore: end.toISOString(),
  };
}

function formatDate(iso: string, locale: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}
