"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import type { ServiceTicketItem } from "@cleanhub/api-client";

import { useTranslation } from "@cleanhub/i18n/react";
import { posToast as toast } from "@/lib/pos-toast";

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
  ticketDetailHref?: (ticketId: string) => string;
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
  ticketDetailHref,
}: CustomerServiceItemListProps) {
  const router = useRouter();
  const { locale } = useTranslation();
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
    <section className="mt-5 overflow-hidden border-y bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2.5">
        <div>
          <h2 className="font-semibold text-foreground">服务项目</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            仅展示该客户档案名下工单的服务项目记录。
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
            placeholder="搜索项目、服务或工单号"
            value={query}
          />
        </div>
      </div>

      <div className="divide-y min-[1400px]:hidden">
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            {loading ? "加载中…" : "没有符合当前条件的服务项目。"}
          </div>
        ) : (
          rows.map((item) => (
            <CustomerServiceItemCard
              href={
                ticketDetailHref?.(item.ticketId) ?? `/tickets/${item.ticketId}`
              }
              item={item}
              key={item.id}
              locale={locale}
              onOpen={(href) => router.push(href)}
            />
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto min-[1400px]:block">
        <div className="min-w-[820px]">
          <div
            className={`grid ${GRID_COLS} bg-muted/50 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground`}
          >
            <div>项目</div>
            <div>服务</div>
            <div>工单 / 备注</div>
            <div>日期</div>
            <div>状态</div>
          </div>

          {rows.length === 0 ? (
            <div className="border-t px-5 py-10 text-center text-sm text-muted-foreground">
              {loading ? "加载中…" : "没有符合当前条件的服务项目。"}
            </div>
          ) : (
            rows.map((item) => {
              const tone =
                CUSTOMER_TICKET_ITEM_STATUS_TONES[item.itemStatus] ??
                "bg-muted text-muted-foreground";
              const note =
                item.defectNotes || item.specialRequest || item.remark;
              return (
                <div
                  className={`grid ${GRID_COLS} items-center border-t px-5 py-4 text-sm`}
                  key={item.id}
                >
                  <div className="font-semibold text-foreground">
                    {item.itemName}
                    {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                  </div>
                  <div className="text-foreground">
                    {item.itemCategory ??
                      (item.itemType
                        ? (CUSTOMER_TICKET_ITEM_TYPE_LABELS[item.itemType] ??
                          item.itemType)
                        : (CUSTOMER_TICKET_TYPE_LABELS[item.ticketType] ??
                          item.ticketType))}
                  </div>
                  <div className="min-w-0">
                    <button
                      className="block truncate font-mono text-xs text-foreground underline-offset-4 hover:underline"
                      type="button"
                      onClick={() =>
                        router.push(
                          ticketDetailHref?.(item.ticketId) ??
                            `/tickets/${item.ticketId}`,
                        )
                      }
                    >
                      {item.ticketNo || item.ticketId.slice(-8).toUpperCase()}
                    </button>
                    {note ? (
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {note}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-muted-foreground">
                    {formatDate(item.createdAt, locale)}
                  </div>
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

function CustomerServiceItemCard({
  item,
  locale,
  href,
  onOpen,
}: {
  item: ServiceItemRow;
  locale: string;
  href: string;
  onOpen: (href: string) => void;
}) {
  const tone =
    CUSTOMER_TICKET_ITEM_STATUS_TONES[item.itemStatus] ??
    "bg-muted text-muted-foreground";
  const note = item.defectNotes || item.specialRequest || item.remark;
  const service =
    item.itemCategory ??
    (item.itemType
      ? (CUSTOMER_TICKET_ITEM_TYPE_LABELS[item.itemType] ?? item.itemType)
      : (CUSTOMER_TICKET_TYPE_LABELS[item.ticketType] ?? item.ticketType));

  return (
    <article className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold text-foreground">
            {item.itemName}
            {item.quantity > 1 ? ` × ${item.quantity}` : ""}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{service}</div>
          {note ? (
            <div className="mt-1 text-xs text-muted-foreground">{note}</div>
          ) : null}
        </div>
        <span
          className={`rounded-md px-2.5 py-1 text-xs font-semibold ${tone}`}
        >
          {CUSTOMER_TICKET_ITEM_STATUS_LABELS[item.itemStatus] ??
            item.itemStatus}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 p-3">
        <div>
          <div className="text-xs text-muted-foreground">创建日期</div>
          <div className="mt-1 text-sm font-medium text-foreground">
            {formatDate(item.createdAt, locale)}
          </div>
        </div>
        <button
          className="h-11 rounded-md border bg-background px-4 font-mono text-xs font-semibold text-foreground hover:bg-accent"
          onClick={() => onOpen(href)}
          type="button"
        >
          工单 {item.ticketNo || item.ticketId.slice(-8).toUpperCase()}
        </button>
      </div>
    </article>
  );
}

function formatDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale, {
    month: "2-digit",
    day: "2-digit",
  });
}
