"use client";

import Link from "next/link";
import { useTranslation } from "@cleanhub/i18n/react";

import { Icon } from "@/components/app-shell";
import { posRoutes } from "@/config";

import {
  formatTicketDateTime,
  formatTicketMoney,
  TICKET_EMPTY_PLACEHOLDER,
  TICKET_SOURCE_LABELS,
  TICKET_TYPE_LABELS,
} from "../constants";
import type { ServiceTicketSummary } from "@cleanhub/api-client";
import { TicketPriorityBadge, TicketStatusBadge } from "./ticket-badges";
import { TicketPagination } from "./ticket-pagination";

type TicketsTableProps = {
  tickets: ServiceTicketSummary[];
  /** Total matching rows across all pages (for the header count + paginator). */
  total: number;
};

/**
 * Read-only ticket table. Rows link to the detail page; row-level edit is
 * intentionally on the detail page to keep the list lightweight (the list-page
 * quick view is the prototype's drawer — implemented separately).
 *
 * The pagination footer is rendered only when there are more rows than the
 * current page (i.e. `total` exceeds the page size). It reads/writes the
 * `page` and `pageSize` URL params, so the server component re-fetches.
 */
export function TicketsTable({ tickets, total }: TicketsTableProps) {
  const { locale } = useTranslation();

  if (tickets.length === 0) {
    return <TicketsEmptyState />;
  }

  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="font-semibold text-slate-950">工单列表</h2>
          <p className="mt-1 text-xs text-slate-500">
            共 {total} 条结果 · 点击工单号或查看按钮打开详情
          </p>
        </div>
      </div>

      <div className="divide-y divide-slate-100 min-[1400px]:hidden">
        {tickets.map((ticket) => (
          <TicketCard key={ticket.id} locale={locale} ticket={ticket} />
        ))}
      </div>

      <div className="hidden overflow-x-auto min-[1400px]:block">
        <div className="min-w-[1080px]">
          <div className="grid grid-cols-[130px_minmax(190px,1.2fr)_100px_110px_110px_150px_90px] bg-slate-50 px-5 py-3 text-[11px] font-semibold tracking-[0.1em] text-slate-400 uppercase">
            <div>工单 / 来源</div>
            <div>客户 / 项目</div>
            <div>类型</div>
            <div>状态</div>
            <div>优先级</div>
            <div>预计取件</div>
            <div className="text-right">操作</div>
          </div>
          {tickets.map((ticket) => (
            <TicketRow key={ticket.id} locale={locale} ticket={ticket} />
          ))}
        </div>
      </div>
      <TicketPagination total={total} />
    </section>
  );
}

function TicketCard({
  locale,
  ticket,
}: {
  locale: string;
  ticket: ServiceTicketSummary;
}) {
  const overdue = isOverdue(ticket);
  const detailHref = posRoutes.ticketDetail(ticket.id);

  return (
    <article className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            className="inline-flex min-h-11 items-center font-mono text-sm font-semibold text-blue-700"
            href={detailHref}
          >
            {ticket.ticketNo ?? ticket.id.slice(-8).toUpperCase()}
          </Link>
          <div className="truncate text-base font-semibold text-slate-900">
            {ticket.customerName}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {TICKET_SOURCE_LABELS[ticket.sourceChannel]} · {ticket.itemCount}{" "}
            个项目
          </div>
        </div>
        <TicketStatusBadge status={ticket.ticketStatus} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">
        <CardDetail
          label="工单类型"
          value={TICKET_TYPE_LABELS[ticket.ticketType]}
        />
        <div>
          <dt className="text-xs text-slate-400">优先级</dt>
          <dd className="mt-1">
            <TicketPriorityBadge priority={ticket.priority} />
          </dd>
        </div>
        <CardDetail
          danger={overdue}
          label="预计取件"
          value={formatTicketDateTime(ticket.expectedPickupAt, locale)}
        />
      </dl>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">工单金额</div>
          <div className="mt-0.5 font-semibold text-slate-950">
            {formatTicketMoney(ticket.totalAmount, ticket.currency)}
          </div>
        </div>
        <Link
          className="flex h-11 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700"
          href={detailHref}
        >
          <Icon className="h-4 w-4" name="eye" />
          查看详情
        </Link>
      </div>
    </article>
  );
}

function CardDetail({
  danger,
  label,
  value,
}: {
  danger?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd
        className={`mt-1 text-sm font-medium ${danger ? "text-red-700" : "text-slate-700"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function TicketRow({
  locale,
  ticket,
}: {
  locale: string;
  ticket: ServiceTicketSummary;
}) {
  const overdue = isOverdue(ticket);
  const detailHref = posRoutes.ticketDetail(ticket.id);
  const sourceLabel = TICKET_SOURCE_LABELS[ticket.sourceChannel];
  const typeLabel = TICKET_TYPE_LABELS[ticket.ticketType];

  return (
    <div className="grid grid-cols-[130px_minmax(190px,1.2fr)_100px_110px_110px_150px_90px] items-center border-t border-slate-100 px-5 py-4 text-sm hover:bg-slate-50/70">
      <div className="min-w-0">
        <Link
          className="font-mono text-xs font-semibold text-blue-700 hover:underline"
          href={detailHref}
        >
          {ticket.ticketNo ?? ticket.id.slice(-8).toUpperCase()}
        </Link>
        <div className="mt-1 text-[11px] text-slate-400">{sourceLabel}</div>
      </div>
      <div className="min-w-0">
        <div className="truncate font-semibold text-slate-800">
          {ticket.customerName}
        </div>
        <div className="mt-1 truncate text-xs text-slate-500">
          {ticket.itemCount} 个项目 · 合计{" "}
          {formatTicketMoney(ticket.totalAmount, ticket.currency)}
        </div>
      </div>
      <div className="text-xs font-medium text-slate-600">{typeLabel}</div>
      <div>
        <TicketStatusBadge status={ticket.ticketStatus} />
      </div>
      <div>
        <TicketPriorityBadge priority={ticket.priority} />
      </div>
      <div>
        <div
          className={`text-xs font-medium ${
            overdue ? "text-red-700" : "text-slate-700"
          }`}
        >
          {formatTicketDateTime(ticket.expectedPickupAt, locale)}
        </div>
        {overdue ? (
          <div className="mt-1 text-[11px] font-semibold text-red-600">
            已逾期
          </div>
        ) : (
          <div className="mt-1 text-[11px] text-slate-400">
            {ticket.expectedPickupAt ? "预计完成" : TICKET_EMPTY_PLACEHOLDER}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-1">
        <Link
          aria-label="查看详情"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-700"
          href={detailHref}
          title="查看详情"
        >
          <Icon className="h-4 w-4" name="eye" />
        </Link>
      </div>
    </div>
  );
}

function TicketsEmptyState() {
  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="px-5 py-14 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
          <Icon className="h-5 w-5" name="search-x" />
        </span>
        <div className="mt-3 font-semibold text-slate-700">没有匹配的工单</div>
        <div className="mt-1 text-sm text-slate-400">
          请调整关键词或筛选条件后重试。
        </div>
      </div>
    </section>
  );
}

/**
 * A ticket is "overdue" when it is still in an active state and its expected
 * pickup time has passed. Mirrors the backend overview overdue definition.
 */
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
