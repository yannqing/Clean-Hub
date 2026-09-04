"use client";

import { useTranslation } from "@cleanhub/i18n/react";
import { useState } from "react";

import { Icon, PosBreadcrumb } from "@/components/app-shell";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { customerDetailPath, posRoutes } from "@/config";
import { AddTicketToCartButton } from "@/features/cart/components";
import { PrintJobControl } from "@/features/hardware/components";

import {
  formatTicketDateTime,
  formatTicketMoney,
  TICKET_EMPTY_PLACEHOLDER,
  TICKET_PRIORITY_LABELS,
  TICKET_SOURCE_LABELS,
  TICKET_TYPE_LABELS,
} from "../constants";
import type {
  PosCatalogService,
  RelatedOrderSummary,
  ServiceTicketDetail,
} from "@cleanhub/api-client";
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
  canManage: boolean;
  catalog: PosCatalogService[];
  from?: string;
  intakeQuery?: string;
  ticket: ServiceTicketDetail;
  relatedOrders: RelatedOrderSummary[];
};

/**
 * Full ticket detail page. Orchestrates three client interactions on top of
 * server-fetched data: status transition dialog, basic-info inline edit, and
 * item CRUD (inside the editor). Deletion is gated behind a confirmation dialog.
 */
export function TicketDetailView({
  canManage,
  catalog,
  from,
  intakeQuery,
  ticket,
  relatedOrders,
}: TicketDetailViewProps) {
  const { locale } = useTranslation();
  const { timeZone } = usePosRuntimeConfig();
  const [editing, setEditing] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const fromIntake = from === "intake";
  const fromCustomer = from === "customer";
  const fromHandover = from === "handover";
  const customerDetailHref = buildCustomerDetailHref(
    ticket.customerId,
    from,
    intakeQuery,
  );
  const ticketCode =
    ticket.ticketNo ?? `TK-${ticket.id.slice(-8).toUpperCase()}`;
  const breadcrumbItems = fromHandover
    ? [
        { href: posRoutes.shiftHandover, label: "店员交接" },
        { label: ticketCode },
      ]
    : fromIntake
    ? [
        { href: buildIntakeReturnPath(intakeQuery), label: "客户接待" },
        { href: customerDetailHref, label: ticket.customerName || "客户档案" },
        { label: ticketCode },
      ]
    : fromCustomer
      ? [
          { href: posRoutes.customers, label: "客户管理" },
          {
            href: customerDetailHref,
            label: ticket.customerName || "客户档案",
          },
          { label: ticketCode },
        ]
      : [{ href: posRoutes.tickets, label: "工单管理" }, { label: ticketCode }];
  const itemLines = (ticket.items ?? []).flatMap((item) => {
    const measurement =
      item.pricingUnit === "per_kg"
        ? `${item.weight ?? "0"} kg${item.bagCount ? ` / ${item.bagCount} bags` : ""}`
        : `${item.quantity} items`;
    return [
      `${item.itemName} | ${measurement} | ${formatTicketMoney(item.chargedUnitAmount, ticket.currency)}`,
      item.chargedUnitAmount !== item.standardUnitAmount
        ? `Standard: ${formatTicketMoney(item.standardUnitAmount, ticket.currency)}`
        : "",
      item.itemColor ? `Color: ${item.itemColor}` : "",
      item.defectNotes ? `Defect: ${item.defectNotes}` : "",
      item.specialRequest ? `Request: ${item.specialRequest}` : "",
      item.labelCode ? `Label: ${item.labelCode}` : "",
    ].filter(Boolean);
  });
  const labelContent = [
    "CleanHub",
    ticketCode,
    ticket.customerName,
    `${ticket.itemCount} items`,
    ...itemLines,
    ticket.expectedPickupAt
      ? formatTicketDateTime(ticket.expectedPickupAt, locale, timeZone)
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <section className="mx-auto w-full max-w-[1080px] space-y-4 pb-12">
      <PosBreadcrumb items={breadcrumbItems} />

      <section className="overflow-hidden border-y bg-background">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <TicketStatusBadge status={ticket.ticketStatus} />
            <TicketPriorityBadge priority={ticket.priority} />
            <span className="font-mono text-xs text-muted-foreground">
              {ticket.id}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <PrintJobControl
              canReprint={canManage}
              content={labelContent}
              documentType="label"
              entityId={ticket.id}
              initialLabel="打印标签"
              title={ticketCode}
            />
            <AddTicketToCartButton
              relatedOrders={relatedOrders}
              ticket={ticket}
            />
            <button
              className="h-11 rounded-md border px-4 text-sm font-semibold text-foreground hover:bg-accent"
              onClick={() => setStatusOpen(true)}
              type="button"
            >
              更新工单状态
            </button>
            <button
              className="flex h-11 items-center gap-2 rounded-md border border-destructive/30 px-4 text-sm font-semibold text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteOpen(true)}
              type="button"
            >
              <Icon className="h-4 w-4" name="trash" />
              删除工单
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4">
          <HeaderMetric
            label="客户"
            value={ticket.customerName}
            note={ticket.customerId.slice(-8).toUpperCase()}
          />
          <HeaderMetric
            label="项目数量"
            value={`${ticket.itemCount} 件`}
            note={`${ticket.items?.length ?? 0} 个工单项目`}
          />
          <HeaderMetric
            label="预计取件"
            value={formatTicketDateTime(ticket.expectedPickupAt, locale, timeZone)}
            note={
              ticket.expectedPickupAt ? "请按时完成" : TICKET_EMPTY_PLACEHOLDER
            }
          />
          <HeaderMetric
            label="工单金额"
            value={formatTicketMoney(ticket.totalAmount, ticket.currency)}
            note="项目金额合计"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Left column: basic info / editor + items */}
        <div className="min-w-0 space-y-5">
          {editing ? (
            <TicketBasicForm
              onCancel={() => setEditing(false)}
              ticket={ticket}
            />
          ) : (
            <section className="border-y bg-background p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-foreground">工单信息</h2>
                <button
                  className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold text-foreground hover:bg-accent"
                  onClick={() => setEditing(true)}
                  type="button"
                >
                  <Icon className="h-4 w-4" name="square-pen" />
                  修改工单
                </button>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4">
                <Detail
                  label="工单类型"
                  value={TICKET_TYPE_LABELS[ticket.ticketType]}
                />
                <Detail
                  label="优先级"
                  value={TICKET_PRIORITY_LABELS[ticket.priority]}
                />
                <Detail
                  label="来源渠道"
                  value={TICKET_SOURCE_LABELS[ticket.sourceChannel]}
                />
                <Detail
                  label="预计取件"
                  value={formatTicketDateTime(ticket.expectedPickupAt, locale, timeZone)}
                />
                <Detail
                  label="完成时间"
                  value={formatTicketDateTime(ticket.completedAt, locale, timeZone)}
                />
                <Detail
                  label="取消时间"
                  value={formatTicketDateTime(ticket.cancelledAt, locale, timeZone)}
                />
                <Detail
                  label="备注"
                  value={ticket.remark ?? TICKET_EMPTY_PLACEHOLDER}
                  wide
                />
              </dl>
            </section>
          )}

          <TicketItemEditor
            canManage={canManage}
            catalog={catalog.filter(
              (service) =>
                service.businessLine === ticket.ticketType &&
                service.currency === ticket.currency,
            )}
            currency={ticket.currency}
            items={ticket.items ?? []}
            ticketId={ticket.id}
          />
        </div>

        {/* Right column: customer, related orders, status meta */}
        <aside className="sticky top-4 space-y-5 self-start">
          <section className="border-y bg-background p-5">
            <h2 className="font-semibold text-foreground">客户与取件信息</h2>
            <dl className="mt-4 space-y-3">
              <Detail
                label="客户姓名"
                value={ticket.customerProfileName ?? ticket.customerName}
              />
              <Detail
                label="所属账户"
                value={ticket.customerAccountName ?? ticket.customerName}
              />
              <Detail
                label="接待店员"
                value={ticket.assistantName ?? TICKET_EMPTY_PLACEHOLDER}
              />
            </dl>
          </section>

          <TicketRelatedOrders
            orderDetailHref={(orderId) =>
              buildOrderDetailHref(orderId, {
                intakeQuery,
                ticketFrom: from,
                ticketId: ticket.id,
              })
            }
            orders={relatedOrders ?? []}
          />

          <section className="border-y bg-background p-5">
            <h2 className="font-semibold text-foreground">状态与时间</h2>
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
                value={formatTicketDateTime(ticket.createdAt, locale, timeZone)}
              />
              <Detail
                label="最后更新"
                value={formatTicketDateTime(ticket.updatedAt, locale, timeZone)}
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

function buildIntakeReturnPath(query: string | undefined): string {
  const keyword = query?.trim();
  if (!keyword) {
    return posRoutes.newIntake;
  }

  return `${posRoutes.newIntake}?q=${encodeURIComponent(keyword)}`;
}

function buildCustomerDetailHref(
  customerId: string,
  from: string | undefined,
  intakeQuery: string | undefined,
): string {
  const base = customerDetailPath(customerId);
  if (from !== "intake") {
    return base;
  }

  const params = new URLSearchParams({ from: "intake" });
  const keyword = intakeQuery?.trim();
  if (keyword) {
    params.set("q", keyword);
  }

  return `${base}?${params.toString()}`;
}

function buildOrderDetailHref(
  orderId: string,
  context: {
    ticketId: string;
    ticketFrom: string | undefined;
    intakeQuery: string | undefined;
  },
): string {
  const params = new URLSearchParams({
    from: "ticket",
    ticketId: context.ticketId,
  });

  if (
    context.ticketFrom === "intake" ||
    context.ticketFrom === "customer" ||
    context.ticketFrom === "handover"
  ) {
    params.set("ticketFrom", context.ticketFrom);
  }

  const keyword = context.intakeQuery?.trim();
  if (context.ticketFrom === "intake" && keyword) {
    params.set("q", keyword);
  }

  return `${posRoutes.orderDetail(orderId)}?${params.toString()}`;
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
    <div className="border-r px-4 py-3 last:border-r-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-base font-semibold text-foreground">
        {value}
      </div>
      <div className="mt-0.5 truncate text-xs text-muted-foreground">
        {note}
      </div>
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
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{value}</dd>
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
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
