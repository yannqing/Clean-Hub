"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { KeyboardEvent } from "react";
import type { ServiceTicketSummary } from "@cleanhub/api-client";
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
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { posRoutes } from "@/config";

import {
  formatTicketDateTime,
  formatTicketMoney,
  TICKET_EMPTY_PLACEHOLDER,
  TICKET_SOURCE_LABELS,
  TICKET_TYPE_LABELS,
} from "../constants";
import {
  TICKET_COLUMN_KEYS,
  TICKET_COLUMN_LABELS,
  TICKET_FILTER_KEYS,
  type TicketColumnKey,
} from "./ticket-filter-params";
import { TicketPriorityBadge, TicketStatusBadge } from "./ticket-badges";
import { TicketPagination } from "./ticket-pagination";

type TicketsTableProps = {
  tickets: ServiceTicketSummary[];
  total: number;
};

export function TicketsTable({ tickets, total }: TicketsTableProps) {
  const { locale } = useTranslation();
  const { timeZone } = usePosRuntimeConfig();
  const router = useRouter();
  const params = useSearchParams();
  const visibleColumns = parseVisibleColumns(
    params.get(TICKET_FILTER_KEYS.columns),
  );
  const visibleColumnCount = TICKET_COLUMN_KEYS.filter((column) =>
    visibleColumns.has(column),
  ).length;
  const text = (value: string) => translatePosText(value, locale);

  if (tickets.length === 0) {
    return <TicketsEmptyState />;
  }

  function openTicket(ticketId: string) {
    router.push(posRoutes.ticketDetail(ticketId));
  }

  function handleRowKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    ticketId: string,
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    openTicket(ticketId);
  }

  return (
    <section className="min-w-0 overflow-hidden border-y bg-background">
      <div className="divide-y min-[900px]:hidden">
        {tickets.map((ticket) => (
          <TicketCard key={ticket.id} locale={locale} ticket={ticket} />
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
              {TICKET_COLUMN_KEYS.map((column) =>
                visibleColumns.has(column) ? (
                  <TableHead key={column}>
                    {text(TICKET_COLUMN_LABELS[column])}
                  </TableHead>
                ) : null,
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => {
              const overdue = isOverdue(ticket);
              const detailHref = posRoutes.ticketDetail(ticket.id);
              return (
                <TableRow
                  className="cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none"
                  key={ticket.id}
                  onClick={() => openTicket(ticket.id)}
                  onKeyDown={(event) => handleRowKeyDown(event, ticket.id)}
                  onMouseEnter={() => router.prefetch(detailHref)}
                  tabIndex={0}
                >
                  {visibleColumns.has("ticket") ? (
                    <TableCell>
                      <span className="block font-mono font-semibold text-foreground">
                        {displayTicketCode(ticket)}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {text(TICKET_SOURCE_LABELS[ticket.sourceChannel])}
                      </span>
                    </TableCell>
                  ) : null}
                  {visibleColumns.has("account") ? (
                    <TableCell className="max-w-56">
                      <span className="block truncate font-medium text-foreground">
                        {ticket.customerAccountName ?? TICKET_EMPTY_PLACEHOLDER}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {ticket.customerAccountPhone ??
                          TICKET_EMPTY_PLACEHOLDER}
                      </span>
                    </TableCell>
                  ) : null}
                  {visibleColumns.has("customer") ? (
                    <TableCell className="max-w-56">
                      <span className="block truncate font-medium text-foreground">
                        {ticket.customerProfileName ?? ticket.customerName}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {ticket.customerProfilePhone ??
                          TICKET_EMPTY_PLACEHOLDER}
                      </span>
                    </TableCell>
                  ) : null}
                  {visibleColumns.has("type") ? (
                    <TableCell>
                      {text(TICKET_TYPE_LABELS[ticket.ticketType])}
                    </TableCell>
                  ) : null}
                  {visibleColumns.has("status") ? (
                    <TableCell>
                      <TicketStatusBadge status={ticket.ticketStatus} />
                    </TableCell>
                  ) : null}
                  {visibleColumns.has("priority") ? (
                    <TableCell>
                      <TicketPriorityBadge priority={ticket.priority} />
                    </TableCell>
                  ) : null}
                  {visibleColumns.has("pickup") ? (
                    <TableCell
                      className={
                        overdue
                          ? "font-medium text-destructive"
                          : "text-muted-foreground"
                      }
                    >
                      <span className="block">
                        {formatTicketDateTime(
                          ticket.expectedPickupAt,
                          locale,
                          timeZone,
                        )}
                      </span>
                      {overdue ? (
                        <span className="mt-0.5 block text-[10px]">
                          {text("已逾期")}
                        </span>
                      ) : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <TicketPagination total={total} />
    </section>
  );
}

function TicketCard({
  locale,
  ticket,
}: {
  locale: SupportedLocale;
  ticket: ServiceTicketSummary;
}) {
  const { timeZone } = usePosRuntimeConfig();
  const overdue = isOverdue(ticket);
  const detailHref = posRoutes.ticketDetail(ticket.id);
  const text = (value: string) => translatePosText(value, locale);

  return (
    <Link
      className="block min-h-24 px-3 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
      href={detailHref}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-xs font-semibold text-foreground">
            {displayTicketCode(ticket)}
          </div>
          <div className="mt-1 truncate text-sm font-medium text-foreground">
            {ticket.customerProfileName ?? ticket.customerName}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {text("客户手机号")}：
            {ticket.customerProfilePhone ?? TICKET_EMPTY_PLACEHOLDER}
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {text("账户")}：
            {ticket.customerAccountName ?? TICKET_EMPTY_PLACEHOLDER} ·{" "}
            {ticket.customerAccountPhone ?? TICKET_EMPTY_PLACEHOLDER}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {text(TICKET_TYPE_LABELS[ticket.ticketType])} · {ticket.itemCount}{" "}
            {text("个项目")}
          </div>
        </div>
        <TicketStatusBadge status={ticket.ticketStatus} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">
            {formatTicketMoney(ticket.totalAmount, ticket.currency)}
          </span>
          <TicketPriorityBadge priority={ticket.priority} />
        </div>
        <span
          className={
            overdue
              ? "flex items-center gap-1 font-medium text-destructive"
              : "flex items-center gap-1 text-muted-foreground"
          }
        >
          {ticket.expectedPickupAt
            ? formatTicketDateTime(ticket.expectedPickupAt, locale, timeZone)
            : TICKET_EMPTY_PLACEHOLDER}
          <Icon className="size-3.5" name="chevron-right" />
        </span>
      </div>
    </Link>
  );
}

function TicketsEmptyState() {
  const { locale } = useTranslation();
  const text = (value: string) => translatePosText(value, locale);

  return (
    <section className="border-y bg-background p-4">
      <div className="border-y border-dashed px-4 py-14 text-center">
        <Icon
          className="mx-auto size-5 text-muted-foreground"
          name="search-x"
        />
        <h2 className="mt-3 text-base font-semibold text-foreground">
          {text("没有匹配的工单")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {text("请调整关键词或筛选条件后重试。")}
        </p>
      </div>
    </section>
  );
}

function displayTicketCode(ticket: ServiceTicketSummary): string {
  return ticket.ticketNo ?? ticket.id.slice(-8).toUpperCase();
}

function parseVisibleColumns(value: string | null): Set<TicketColumnKey> {
  if (!value) {
    return new Set(TICKET_COLUMN_KEYS);
  }

  const requested = new Set(value.split(","));
  const visible = TICKET_COLUMN_KEYS.filter((column) => requested.has(column));
  return new Set(visible.length > 0 ? visible : TICKET_COLUMN_KEYS);
}

function isOverdue(ticket: ServiceTicketSummary): boolean {
  if (!ticket.expectedPickupAt) {
    return false;
  }
  if (
    ticket.ticketStatus === "picked_up" ||
    ticket.ticketStatus === "cancelled"
  ) {
    return false;
  }
  return new Date(ticket.expectedPickupAt).getTime() < Date.now();
}
