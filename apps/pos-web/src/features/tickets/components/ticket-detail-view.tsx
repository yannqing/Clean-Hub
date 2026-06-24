"use client";

import { toast } from "@cleanhub/ui";
import Link from "next/link";
import { useState } from "react";

import { Icon } from "@/components/app-shell";
import { posRoutes } from "@/config";

import {
  formatTicketDateTime,
  formatTicketMoney,
  TICKET_EMPTY_PLACEHOLDER,
  TICKET_PRIORITY_LABELS,
  TICKET_SOURCE_LABELS,
  TICKET_TYPE_LABELS,
} from "../constants";
import type { RelatedOrderSummary, ServiceTicketDetail } from "@cleanhub/api-client";
import { TicketBasicForm } from "./ticket-basic-form";
import { TicketDeleteDialog } from "./ticket-delete-dialog";
import { TicketItemEditor } from "./ticket-item-editor";
import {
  TicketPriorityBadge,
  TicketSourceBadge,
  TicketStatusBadge,
} from "./ticket-badges";
import { TicketRelatedOrders } from "./ticket-related-orders";
import { TicketStatusDialog } from "./ticket-status-dialog";

type TicketDetailViewProps = {
  ticket: ServiceTicketDetail;
  relatedOrders: RelatedOrderSummary[];
};

/**
 * Full ticket detail page. Orchestrates three client interactions on top of
 * server-fetched data: status transition dialog, basic-info inline edit, and
 * item CRUD (inside the editor). Deletion is gated behind a confirmation dialog.
 */
export function TicketDetailView({
  ticket,
  relatedOrders,
}: TicketDetailViewProps) {
  const [editing, setEditing] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <section>
      {/* Breadcrumb + back */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
          <span>POS</span>
          <Icon className="h-3.5 w-3.5" name="chevron-right" />
          <Link className="hover:text-blue-700" href={posRoutes.tickets}>
            工单管理
          </Link>
          <Icon className="h-3.5 w-3.5" name="chevron-right" />
          <span className="text-slate-600">工单详情</span>
        </div>
        <Link
          className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          href={posRoutes.tickets}
        >
          <Icon className="h-4 w-4" name="arrow-left" />
          返回工单列表
        </Link>
      </div>

      {/* Header */}
      <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <Icon className="h-5 w-5" name="clipboard-list" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-semibold text-slate-950">
                {ticket.ticketNo ?? ticket.id.slice(-8).toUpperCase()}
              </h1>
              <TicketStatusBadge status={ticket.ticketStatus} />
              <TicketPriorityBadge priority={ticket.priority} />
            </div>
            <div className="mt-1 text-sm text-slate-500">
              工单 ID：{ticket.id} · 创建于 {formatTicketDateTime(ticket.createdAt)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => toast.info("打印能力尚未接入，敬请期待。")}
              type="button"
            >
              <Icon className="h-4 w-4" name="printer" />
              打印标签
            </button>
            <button
              className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
              onClick={() =>
                toast.info("创建订单功能尚在开发中，敬请期待。")
              }
              type="button"
            >
              <Icon className="h-4 w-4" name="receipt" />
              创建订单
            </button>
            <button
              className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => setStatusOpen(true)}
              type="button"
            >
              更新工单状态
            </button>
            <button
              className="flex h-10 items-center gap-2 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-600 hover:bg-red-50"
              onClick={() => setDeleteOpen(true)}
              type="button"
            >
              <Icon className="h-4 w-4" name="trash" />
              删除工单
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-slate-200 lg:grid-cols-4">
          <HeaderMetric
            label="客户"
            value={ticket.customerName}
            note={ticket.customerId.slice(-8).toUpperCase()}
          />
          <HeaderMetric
            label="项目数量"
            value={`${ticket.itemCount} 件`}
            note={`${ticket.items.length} 个工单项目`}
          />
          <HeaderMetric
            label="预计取件"
            value={formatTicketDateTime(ticket.expectedPickupAt)}
            note={ticket.expectedPickupAt ? "请按时完成" : TICKET_EMPTY_PLACEHOLDER}
          />
          <HeaderMetric
            label="工单金额"
            value={formatTicketMoney(ticket.totalAmount)}
            note="项目金额合计"
          />
        </div>
      </section>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Left column: basic info / editor + items */}
        <div className="min-w-0 space-y-5">
          {editing ? (
            <TicketBasicForm onCancel={() => setEditing(false)} ticket={ticket} />
          ) : (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-950">工单信息</h2>
                <button
                  className="flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"
                  onClick={() => setEditing(true)}
                  type="button"
                >
                  <Icon className="h-4 w-4" name="square-pen" />
                  修改工单
                </button>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4">
                <Detail label="工单类型" value={TICKET_TYPE_LABELS[ticket.ticketType]} />
                <Detail label="优先级" value={TICKET_PRIORITY_LABELS[ticket.priority]} />
                <Detail label="来源渠道" value={TICKET_SOURCE_LABELS[ticket.sourceChannel]} />
                <Detail
                  label="预计取件"
                  value={formatTicketDateTime(ticket.expectedPickupAt)}
                />
                <Detail
                  label="完成时间"
                  value={formatTicketDateTime(ticket.completedAt)}
                />
                <Detail
                  label="取消时间"
                  value={formatTicketDateTime(ticket.cancelledAt)}
                />
                <Detail
                  label="备注"
                  value={ticket.remark ?? TICKET_EMPTY_PLACEHOLDER}
                  wide
                />
              </dl>
            </section>
          )}

          <TicketItemEditor items={ticket.items} ticketId={ticket.id} />
        </div>

        {/* Right column: customer, related orders, status meta */}
        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <h2 className="font-semibold text-slate-950">客户与取件信息</h2>
            <dl className="mt-4 space-y-3">
              <Detail label="客户姓名" value={ticket.customerName} />
              <Detail
                label="客户档案"
                value={ticket.customerId.slice(-8).toUpperCase()}
              />
              <Detail
                label="接待店员"
                value={ticket.assistantId ?? TICKET_EMPTY_PLACEHOLDER}
              />
            </dl>
          </section>

          <TicketRelatedOrders orders={relatedOrders} />

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <h2 className="font-semibold text-slate-950">状态与时间</h2>
            <dl className="mt-4 space-y-3">
              <DetailRow
                label="当前状态"
                value={<TicketStatusBadge status={ticket.ticketStatus} />}
              />
              <DetailRow
                label="优先级"
                value={<TicketPriorityBadge priority={ticket.priority} />}
              />
              <DetailRow
                label="来源"
                value={<TicketSourceBadge source={ticket.sourceChannel} />}
              />
              <Detail
                label="创建时间"
                value={formatTicketDateTime(ticket.createdAt)}
              />
              <Detail
                label="最后更新"
                value={formatTicketDateTime(ticket.updatedAt)}
              />
            </dl>
          </section>
        </aside>
      </div>

      <TicketStatusDialog
        current={ticket.ticketStatus}
        onClose={() => setStatusOpen(false)}
        open={statusOpen}
        ticketId={ticket.id}
        version={ticket.version}
      />
      <TicketDeleteDialog
        onClose={() => setDeleteOpen(false)}
        open={deleteOpen}
        ticketId={ticket.id}
        ticketNo={ticket.ticketNo}
      />
    </section>
  );
}

function HeaderMetric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="border-r border-slate-100 px-5 py-4 last:border-r-0">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 truncate text-base font-semibold text-slate-950">
        {value}
      </div>
      <div className="mt-0.5 truncate text-xs text-slate-400">{note}</div>
    </div>
  );
}

function Detail({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-700">{value}</dd>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
