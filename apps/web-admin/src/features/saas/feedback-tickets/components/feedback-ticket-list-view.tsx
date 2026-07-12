"use client";

import {
  Badge,
  Button,
  Checkbox,
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
  cn,
} from "@cleanhub/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useSaasI18n } from "@/i18n";

import {
  feedbackTicketPriorityOptions,
  feedbackTicketStatusOptions,
} from "../constants";
import {
  getFeedbackTicketDetailQuery,
  getFeedbackTicketListQuery,
} from "../queries";
import { computeTicketSla } from "../sla";
import type {
  FeedbackTicketDetail,
  FeedbackTicketListItem,
  FeedbackTicketStatus,
} from "../types";
import { FeedbackTicketAssigneeControl } from "./feedback-ticket-assignee-control";
import { FeedbackTicketBatchToolbar } from "./feedback-ticket-batch-toolbar";
import { FeedbackTicketSlaBadge } from "./feedback-ticket-sla-badge";
import { FeedbackTicketStatusControl } from "./feedback-ticket-status-control";
import { FeedbackTicketTimeline } from "./feedback-ticket-timeline";

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

function statusLabel(
  m: ReturnType<typeof useSaasI18n>["m"],
  status: FeedbackTicketStatus,
): string {
  switch (status) {
    case "open":
      return m.common.statusLabels.open;
    case "in_progress":
      return m.common.statusLabels.inProgress;
    case "resolved":
      return m.common.statusLabels.resolved;
    case "closed":
      return m.common.statusLabels.closed;
    default:
      return status;
  }
}

function priorityLabel(
  m: ReturnType<typeof useSaasI18n>["m"],
  priority: string,
): string {
  return (
    m.common.priorityLabels[priority as keyof typeof m.common.priorityLabels] ??
    priority
  );
}

export function FeedbackTicketListView() {
  const { m, formatDateTime } = useSaasI18n();
  const [tickets, setTickets] = useState<FeedbackTicketListItem[]>([]);
  const [selectedTicket, setSelectedTicket] =
    useState<FeedbackTicketDetail | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
      setError(getErrorMessage(loadError) || m.feedbackTickets.loadError);
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
      setDetailError(getErrorMessage(loadError) || m.feedbackTickets.loadError);
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

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return next;
    });
  }

  const visibleTicketIds = useMemo(
    () => new Set(tickets.map((t) => t.id)),
    [tickets],
  );

  /**
   * Selection is scoped to the currently visible list. We derive the pruned
   * selection at render time instead of mutating state in an effect (which
   * would trigger cascading renders), so stale IDs left over from filter
   * changes never reach the batch toolbar or the "select all" checkbox.
   */
  const selectedVisibleIds = useMemo(
    () =>
      [...selectedIds].filter((id) => visibleTicketIds.has(id)),
    [selectedIds, visibleTicketIds],
  );

  const allVisibleChecked =
    tickets.length > 0 && tickets.every((t) => selectedIds.has(t.id));
  const someVisibleChecked =
    !allVisibleChecked && tickets.some((t) => selectedIds.has(t.id));

  function toggleSelectAll(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (checked) {
        for (const t of tickets) {
          next.add(t.id);
        }
      } else {
        for (const t of tickets) {
          next.delete(t.id);
        }
      }

      return next;
    });
  }

  /**
   * After a batch operation, drop stale IDs, re-load the list to reflect the
   * server state, and refresh the open detail (if it was in the batch).
   */
  async function handleBatchOutcome(succeededIds: string[]) {
    setSelectedIds((current) => {
      const next = new Set(current);

      for (const id of succeededIds) {
        next.delete(id);
      }

      return next;
    });

    await loadTickets();

    setSelectedTicket((current) => {
      if (current && succeededIds.includes(current.id)) {
        // Re-hydrate the detail panel with the updated ticket.
        void loadTicketDetail(current.id);
      }

      return current;
    });
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
          setError(getErrorMessage(loadError) || m.feedbackTickets.loadError);
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
          <Badge variant="secondary">{m.feedbackTickets.badge}</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            {m.feedbackTickets.title}
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
                  {statusLabel(m, option.value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="feedback-priority-filter">{m.feedbackTickets.priority}</Label>
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
                  {priorityLabel(m, option.value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="feedback-tenant-filter">{m.feedbackTickets.tenantId}</Label>
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
          <Label htmlFor="feedback-assignee-filter">{m.feedbackTickets.assigneeId}</Label>
          <Input
            id="feedback-assignee-filter"
            onChange={(event) => {
              setLoading(true);
              setAssigneeUserId(event.target.value);
            }}
            placeholder={m.feedbackTickets.assigneePlaceholder}
            value={assigneeUserId}
          />
        </div>
      </div>

      <FeedbackTicketBatchToolbar
        onOutcome={handleBatchOutcome}
        selectedIds={selectedVisibleIds}
      />

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
                  {m.feedbackTickets.emptyTitle}
                </h2>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-9">
                    <Checkbox
                      aria-label={m.feedbackTickets.batch.selectAll}
                      checked={
                        allVisibleChecked
                          ? true
                          : someVisibleChecked
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(value) =>
                        toggleSelectAll(value === true)
                      }
                    />
                  </TableHead>
                  <TableHead>{m.feedbackTickets.columns.ticket}</TableHead>
                  <TableHead>{m.common.status}</TableHead>
                  <TableHead>{m.feedbackTickets.priority}</TableHead>
                  <TableHead>{m.feedbackTickets.columns.sla}</TableHead>
                  <TableHead>{m.feedbackTickets.columns.tenant}</TableHead>
                  <TableHead>{m.feedbackTickets.columns.assignee}</TableHead>
                  <TableHead>{m.feedbackTickets.columns.created}</TableHead>
                  <TableHead className="text-right">{m.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => {
                  const checked = selectedIds.has(ticket.id);
                  const sla = computeTicketSla(ticket);
                  const isUrgent = ticket.priority === "urgent";
                  const isOverdue = sla.status === "overdue";
                  // Urgent tickets get a red left edge; overdue ones get a
                  // destructive-tinted row. Both highlight together when both apply.
                  const rowAccent = cn(
                    isUrgent &&
                      "border-l-2 border-l-destructive/70 bg-destructive/5",
                    isOverdue &&
                      !isUrgent &&
                      "bg-amber-500/5",
                  );

                  return (
                    <TableRow
                      className={rowAccent}
                      data-priority={isUrgent ? "urgent" : undefined}
                      data-sla={sla.status}
                      key={ticket.id}
                    >
                      <TableCell>
                        <Checkbox
                          aria-label={`${m.feedbackTickets.batch.selectAll}: ${ticket.title}`}
                          checked={checked}
                          onCheckedChange={(value) =>
                            toggleSelected(ticket.id, value === true)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{ticket.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {ticket.id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(ticket.status)}>
                          {statusLabel(m, ticket.status)}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={cn(
                          isUrgent && "font-semibold text-destructive",
                        )}
                      >
                        {priorityLabel(m, ticket.priority)}
                      </TableCell>
                      <TableCell>
                        <FeedbackTicketSlaBadge ticket={ticket} />
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
                          {m.feedbackTickets.detail}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <aside className="grid content-start gap-5 p-5">
          <div>
            <h2 className="text-base font-semibold">{m.feedbackTickets.detailTitle}</h2>
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
                    {m.feedbackTickets.fields.title}
                  </p>
                  <p className="mt-1 font-medium">{selectedTicket.title}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {m.feedbackTickets.fields.description}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {selectedTicket.description ?? m.feedbackTickets.fields.noDescription}
                  </p>
                </div>
                <div className="grid gap-2 text-sm">
                  <p>
                    {m.feedbackTickets.fields.reporter}{" "}
                    {selectedTicket.reporterUserId ?? m.common.unknown}
                  </p>
                  <p>
                    {m.feedbackTickets.fields.source} {selectedTicket.source ?? m.common.unknown}
                  </p>
                  <p>
                    {m.feedbackTickets.fields.updated}{" "}
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

              <FeedbackTicketTimeline detail={selectedTicket} />
            </>
          ) : (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              {m.feedbackTickets.selectHint}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
