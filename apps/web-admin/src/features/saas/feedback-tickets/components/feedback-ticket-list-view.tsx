"use client";

import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cleanhub/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  feedbackTicketPriorityOptions,
  feedbackTicketStatusOptions,
} from "../constants";
import {
  getFeedbackTicketDetailQuery,
  getFeedbackTicketListQuery,
} from "../queries";
import type {
  FeedbackTicketDetail,
  FeedbackTicketListItem,
  FeedbackTicketStatus,
} from "../types";
import { FeedbackTicketAssigneeControl } from "./feedback-ticket-assignee-control";
import { FeedbackTicketStatusControl } from "./feedback-ticket-status-control";
import { useSaasI18n } from "@/i18n";

type StatusFilter = "all" | FeedbackTicketStatus;
type PriorityFilter = "all" | string;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

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

function getSelectedTicket(
  detail: FeedbackTicketDetail | null,
  tickets: FeedbackTicketListItem[],
): FeedbackTicketDetail | null {
  if (!detail) {
    return null;
  }

  const latest = tickets.find((ticket) => ticket.id === detail.id);

  return latest
    ? {
        ...detail,
        ...latest,
      }
    : detail;
}

export function FeedbackTicketListView() {
  const { m, formatDateTime } = useSaasI18n();
  const [tickets, setTickets] = useState<FeedbackTicketListItem[]>([]);
  const [selectedTicket, setSelectedTicket] =
    useState<FeedbackTicketDetail | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [tenantId, setTenantId] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const listQuery = useMemo(
    () => ({
      limit: 50,
      offset: 0,
      status: status === "all" ? undefined : status,
      priority: priority === "all" ? undefined : priority,
      tenantId: tenantId.trim() || undefined,
      assigneeUserId: assigneeUserId.trim() || undefined,
    }),
    [assigneeUserId, priority, status, tenantId],
  );

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getFeedbackTicketListQuery(listQuery);
      setTickets(data);
      setSelectedTicket((current) => getSelectedTicket(current, data));
    } catch (loadError) {
      setError(getErrorMessage(loadError) || m.feedback.loadError);
    } finally {
      setLoading(false);
    }
  }, [listQuery]);

  async function loadTicketDetail(ticketId: string) {
    setDetailLoading(true);
    setDetailError(null);

    try {
      const detail = await getFeedbackTicketDetailQuery(ticketId);
      setSelectedTicket(detail);
    } catch (loadError) {
      setDetailError(getErrorMessage(loadError) || m.feedback.loadError);
    } finally {
      setDetailLoading(false);
    }
  }

  function handleTicketUpdated(ticket: FeedbackTicketDetail) {
    setSelectedTicket(ticket);
    setTickets((current) =>
      current.map((item) =>
        item.id === ticket.id
          ? {
              id: ticket.id,
              tenantId: ticket.tenantId,
              branchId: ticket.branchId,
              title: ticket.title,
              status: ticket.status,
              priority: ticket.priority,
              source: ticket.source,
              reporterUserId: ticket.reporterUserId,
              assigneeUserId: ticket.assigneeUserId,
              createdAt: ticket.createdAt,
              updatedAt: ticket.updatedAt,
            }
          : item,
      ),
    );
  }

  useEffect(() => {
    let isCurrent = true;

    getFeedbackTicketListQuery(listQuery)
      .then((data) => {
        if (!isCurrent) {
          return;
        }

        setTickets(data);
        setSelectedTicket((current) => getSelectedTicket(current, data));
      })
      .catch((loadError: unknown) => {
        if (isCurrent) {
          setError(getErrorMessage(loadError) || m.feedback.loadError);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [listQuery]);

  return (
    <section className="min-h-[560px]">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">{m.feedback.badge}</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            {m.feedback.title}
          </h1>
        </div>

        <Button onClick={loadTickets} type="button" variant="outline">
          {m.common.refresh}
        </Button>
      </div>

      <div className="grid gap-3 border-b p-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="grid gap-2">
          <Label htmlFor="feedback-status-filter">{m.common.status}</Label>
          <Select
            onValueChange={(value) => {
              setLoading(true);
              setStatus(value as StatusFilter);
            }}
            value={status}
          >
            <SelectTrigger className="w-full" id="feedback-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{m.common.allStatuses}</SelectItem>
              {feedbackTicketStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.value === "open"
                    ? m.common.statusLabels.open
                    : option.value === "in_progress"
                      ? m.common.statusLabels.inProgress
                      : option.value === "resolved"
                        ? m.common.statusLabels.resolved
                        : m.common.statusLabels.closed}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="feedback-priority-filter">{m.feedback.priority}</Label>
          <Select
            onValueChange={(value) => {
              setLoading(true);
              setPriority(value);
            }}
            value={priority}
          >
            <SelectTrigger className="w-full" id="feedback-priority-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{m.common.allPriorities}</SelectItem>
              {feedbackTicketPriorityOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {m.common.priorityLabels[
                    option.value as keyof typeof m.common.priorityLabels
                  ] ?? option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="feedback-tenant-filter">{m.feedback.tenantId}</Label>
          <Input
            id="feedback-tenant-filter"
            onChange={(event) => {
              setLoading(true);
              setTenantId(event.target.value);
            }}
            placeholder={m.common.optionalTenantUlid}
            value={tenantId}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="feedback-assignee-filter">{m.feedback.assigneeId}</Label>
          <Input
            id="feedback-assignee-filter"
            onChange={(event) => {
              setLoading(true);
              setAssigneeUserId(event.target.value);
            }}
            placeholder={m.feedback.assigneePlaceholder}
            value={assigneeUserId}
          />
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="border-b xl:border-b-0 xl:border-r">
          {loading ? (
            <div className="grid gap-3 p-5">
              {[0, 1, 2].map((item) => (
                <div
                  className="h-14 animate-pulse rounded-md bg-muted"
                  key={item}
                />
              ))}
            </div>
          ) : error ? (
            <div className="p-5">
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-5">
              <div className="rounded-md border border-dashed p-8 text-center">
                <h2 className="text-base font-semibold">
                  {m.feedback.emptyTitle}
                </h2>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{m.feedback.columns.ticket}</TableHead>
                  <TableHead>{m.common.status}</TableHead>
                  <TableHead>{m.feedback.priority}</TableHead>
                  <TableHead>{m.feedback.columns.tenant}</TableHead>
                  <TableHead>{m.feedback.columns.assignee}</TableHead>
                  <TableHead>{m.feedback.columns.created}</TableHead>
                  <TableHead className="text-right">{m.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell>
                      <div className="font-medium">{ticket.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {ticket.id}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(ticket.status)}>
                        {ticket.status === "open"
                          ? m.common.statusLabels.open
                          : ticket.status === "in_progress"
                            ? m.common.statusLabels.inProgress
                            : ticket.status === "resolved"
                              ? m.common.statusLabels.resolved
                              : m.common.statusLabels.closed}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {m.common.priorityLabels[
                        ticket.priority as keyof typeof m.common.priorityLabels
                      ] ?? ticket.priority}
                    </TableCell>
                    <TableCell>{ticket.tenantId ?? m.common.platform}</TableCell>
                    <TableCell>
                      {ticket.assigneeUserId ?? m.common.roleLabels.unassigned}
                    </TableCell>
                    <TableCell>
                      {formatDateTime(ticket.createdAt) || m.common.invalidDate}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        onClick={() => loadTicketDetail(ticket.id)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {m.feedback.detail}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <aside className="grid content-start gap-5 p-5">
          <div>
            <h2 className="text-base font-semibold">{m.feedback.detailTitle}</h2>
          </div>

          {detailLoading ? (
            <div className="grid gap-3">
              <div className="h-24 animate-pulse rounded-md bg-muted" />
              <div className="h-44 animate-pulse rounded-md bg-muted" />
            </div>
          ) : detailError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {detailError}
            </div>
          ) : selectedTicket ? (
            <>
              <div className="grid gap-3 rounded-md border p-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {m.feedback.fields.title}
                  </p>
                  <p className="mt-1 font-medium">{selectedTicket.title}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {m.feedback.fields.description}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {selectedTicket.description ?? m.feedback.fields.noDescription}
                  </p>
                </div>
                <div className="grid gap-2 text-sm">
                  <p>
                    {m.feedback.fields.reporter}{" "}
                    {selectedTicket.reporterUserId ?? m.common.unknown}
                  </p>
                  <p>
                    {m.feedback.fields.source} {selectedTicket.source ?? m.common.unknown}
                  </p>
                  <p>
                    {m.feedback.fields.updated}{" "}
                    {formatDateTime(selectedTicket.updatedAt) || m.common.invalidDate}
                  </p>
                </div>
              </div>

              <FeedbackTicketStatusControl
                key={`status-${selectedTicket.id}-${selectedTicket.status}`}
                onUpdated={handleTicketUpdated}
                status={selectedTicket.status}
                ticketId={selectedTicket.id}
              />

              <FeedbackTicketAssigneeControl
                assigneeUserId={selectedTicket.assigneeUserId}
                key={`assignee-${selectedTicket.id}-${selectedTicket.assigneeUserId ?? "none"}`}
                onUpdated={handleTicketUpdated}
                ticketId={selectedTicket.id}
              />
            </>
          ) : (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              {m.feedback.selectHint}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
