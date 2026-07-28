"use client";

import { Badge } from "@cleanhub/ui";
import { MessageSquareWarning } from "lucide-react";
import { useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { SaasBreadcrumbs } from "@/features/saas/shared";
import { useSaasI18n } from "@/i18n";

import type { FeedbackTicketDetail, FeedbackTicketStatus } from "../types";
import { FeedbackTicketAssigneeControl } from "./feedback-ticket-assignee-control";
import { FeedbackTicketSlaBadge } from "./feedback-ticket-sla-badge";
import { FeedbackTicketStatusControl } from "./feedback-ticket-status-control";
import { FeedbackTicketTimeline } from "./feedback-ticket-timeline";

type FeedbackTicketDetailViewProps = {
  initialTicket: FeedbackTicketDetail;
};

function getStatusVariant(
  status: FeedbackTicketStatus,
): "default" | "outline" | "secondary" {
  if (status === "open") {
    return "default";
  }

  if (status === "in_progress") {
    return "secondary";
  }

  return "outline";
}

export function FeedbackTicketDetailView({
  initialTicket,
}: FeedbackTicketDetailViewProps) {
  const { m, formatDateTime } = useSaasI18n();
  const [ticket, setTicket] = useState(initialTicket);
  const status =
    ticket.status === "open"
      ? m.common.statusLabels.open
      : ticket.status === "in_progress"
        ? m.common.statusLabels.inProgress
        : ticket.status === "resolved"
          ? m.common.statusLabels.resolved
          : m.common.statusLabels.closed;
  const priority =
    m.common.priorityLabels[
      ticket.priority as keyof typeof m.common.priorityLabels
    ] ?? ticket.priority;

  return (
    <section className="mx-auto w-full max-w-[960px] space-y-3 pb-20">
      <h1 className="sr-only">{ticket.title}</h1>
      <SaasBreadcrumbs
        ariaLabel={m.feedbackTickets.detailTitle}
        items={[{ label: ticket.title }]}
        rootHref={webAdminRoutes.saas.feedbackTickets}
        rootIcon={MessageSquareWarning}
        rootLabel={m.feedbackTickets.title}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-5">
          <section className="grid gap-5 border-y bg-background px-5 py-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getStatusVariant(ticket.status)}>{status}</Badge>
              <Badge variant="outline">{priority}</Badge>
              <FeedbackTicketSlaBadge ticket={ticket} />
            </div>

            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                {ticket.title}
              </h2>
              <p className="mt-1 break-all text-xs text-muted-foreground">
                {ticket.id}
              </p>
            </div>

            <div className="grid gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {m.feedbackTickets.fields.description}
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-6">
                {ticket.description ?? m.feedbackTickets.fields.noDescription}
              </p>
            </div>
          </section>

          <section className="border-y bg-background px-5 py-5">
            <FeedbackTicketTimeline detail={ticket} />
          </section>
        </div>

        <aside className="grid gap-5">
          <section className="border-y bg-background px-4 py-5">
            <FeedbackTicketStatusControl
              key={`status-${ticket.id}-${ticket.status}`}
              onUpdated={setTicket}
              status={ticket.status}
              ticketId={ticket.id}
            />
          </section>

          <section className="border-y bg-background px-4 py-5">
            <FeedbackTicketAssigneeControl
              assigneeUserId={ticket.assigneeUserId}
              key={`assignee-${ticket.id}-${ticket.assigneeUserId ?? "none"}`}
              onUpdated={setTicket}
              ticketId={ticket.id}
            />
          </section>

          <section className="grid gap-4 border-y bg-background px-4 py-5">
            <h2 className="text-sm font-semibold">
              {m.feedbackTickets.detailTitle}
            </h2>

            <dl className="divide-y text-sm">
              <div className="grid gap-1 py-2 first:pt-0">
                <dt className="text-xs text-muted-foreground">
                  {m.feedbackTickets.tenantId}
                </dt>
                <dd className="break-all font-medium">
                  {ticket.tenantId ?? m.common.platform}
                </dd>
                {ticket.branchId ? (
                  <dd className="break-all text-xs text-muted-foreground">
                    {ticket.branchId}
                  </dd>
                ) : null}
              </div>
              <div className="grid gap-1 py-2">
                <dt className="text-xs text-muted-foreground">
                  {m.feedbackTickets.fields.reporter}
                </dt>
                <dd className="break-all font-medium">
                  {ticket.reporterUserId ?? m.common.unknown}
                </dd>
              </div>
              <div className="grid gap-1 py-2">
                <dt className="text-xs text-muted-foreground">
                  {m.feedbackTickets.fields.source}
                </dt>
                <dd className="break-all font-medium">
                  {ticket.source ?? m.common.unknown}
                </dd>
              </div>
              <div className="grid gap-1 py-2">
                <dt className="text-xs text-muted-foreground">
                  {m.feedbackTickets.columns.created}
                </dt>
                <dd className="font-medium">
                  {formatDateTime(ticket.createdAt) || m.common.invalidDate}
                </dd>
              </div>
              <div className="grid gap-1 py-2 last:pb-0">
                <dt className="text-xs text-muted-foreground">
                  {m.feedbackTickets.fields.updated}
                </dt>
                <dd className="font-medium">
                  {formatDateTime(ticket.updatedAt) || m.common.invalidDate}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </section>
  );
}
