"use client";

import {
  Badge,
  Button,
  Checkbox,
  Icon,
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
import { MessageSquareWarning, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Pagination } from "@/components/pagination";
import { webAdminRoutes } from "@/config/routes";
import {
  SaasPageHeader,
  SaasTableSurface,
  saasCompactTableClassName,
} from "@/features/saas/shared";
import { useSaasI18n } from "@/i18n";

import {
  feedbackTicketPriorityOptions,
  feedbackTicketStatusOptions,
} from "../constants";
import { getFeedbackTicketListQuery } from "../queries";
import { computeTicketSla } from "../sla";
import type { FeedbackTicketListItem, FeedbackTicketStatus } from "../types";
import { FeedbackTicketBatchToolbar } from "./feedback-ticket-batch-toolbar";
import { FeedbackTicketSlaBadge } from "./feedback-ticket-sla-badge";

type StatusFilter = "all" | FeedbackTicketStatus;
type PriorityFilter = "all" | string;
const PAGE_SIZE = 10;
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

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
  const router = useRouter();
  const [tickets, setTickets] = useState<FeedbackTicketListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<StatusFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [tenantId, setTenantId] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const normalizedTenantId = tenantId.trim();
  const normalizedAssigneeUserId = assigneeUserId.trim();
  const tenantIdFilter = ULID_PATTERN.test(normalizedTenantId)
    ? normalizedTenantId
    : undefined;
  const assigneeUserIdFilter = ULID_PATTERN.test(normalizedAssigneeUserId)
    ? normalizedAssigneeUserId
    : undefined;

  const listQuery = useMemo(
    () => ({
      limit: PAGE_SIZE + 1,
      offset,
      status: status === "all" ? undefined : status,
      priority: priority === "all" ? undefined : priority,
      tenantId: tenantIdFilter,
      assigneeUserId: assigneeUserIdFilter,
    }),
    [assigneeUserIdFilter, offset, priority, status, tenantIdFilter],
  );

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getFeedbackTicketListQuery(listQuery);
      setTickets(data.slice(0, PAGE_SIZE));
      setHasNextPage(data.length > PAGE_SIZE);
    } catch (loadError) {
      setError(getErrorMessage(loadError) || m.feedbackTickets.loadError);
    } finally {
      setLoading(false);
    }
  }, [listQuery, m.feedbackTickets.loadError]);

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
    () => [...selectedIds].filter((id) => visibleTicketIds.has(id)),
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

  /** Drop updated IDs from the selection and reload the server-backed list. */
  async function handleBatchOutcome(succeededIds: string[]) {
    setSelectedIds((current) => {
      const next = new Set(current);

      for (const id of succeededIds) {
        next.delete(id);
      }

      return next;
    });

    await loadTickets();
  }

  useEffect(() => {
    let isCurrent = true;

    getFeedbackTicketListQuery(listQuery)
      .then((data) => {
        if (!isCurrent) {
          return;
        }

        setTickets(data.slice(0, PAGE_SIZE));
        setHasNextPage(data.length > PAGE_SIZE);
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
  }, [listQuery, m.feedbackTickets.loadError]);

  return (
    <section className="space-y-7 pb-8">
      <SaasPageHeader
        actions={
          <Button
            className="h-8 gap-1.5 px-2.5 text-xs"
            disabled={loading}
            onClick={loadTickets}
            size="sm"
            type="button"
            variant="outline"
          >
            <Icon
              aria-hidden
              className={loading ? "animate-spin" : undefined}
              icon={RefreshCw}
              size={14}
            />
            {m.common.refresh}
          </Button>
        }
        icon={MessageSquareWarning}
        title={m.feedbackTickets.title}
      />

      <div className="grid gap-2 border-y bg-background px-3 py-2.5 md:grid-cols-2 xl:grid-cols-4">
        <div className="grid gap-2">
          <Label className="sr-only" htmlFor="feedback-status-filter">
            {m.common.status}
          </Label>
          <Select
            onValueChange={(value) => {
              setLoading(true);
              setStatus(value as StatusFilter);
              setOffset(0);
            }}
            value={status}
          >
            <SelectTrigger
              className="h-8 w-full text-xs"
              id="feedback-status-filter"
            >
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
          <Label className="sr-only" htmlFor="feedback-priority-filter">
            {m.feedbackTickets.priority}
          </Label>
          <Select
            onValueChange={(value) => {
              setLoading(true);
              setPriority(value);
              setOffset(0);
            }}
            value={priority}
          >
            <SelectTrigger
              className="h-8 w-full text-xs"
              id="feedback-priority-filter"
            >
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
          <Label className="sr-only" htmlFor="feedback-tenant-filter">
            {m.feedbackTickets.tenantId}
          </Label>
          <Input
            className="h-8 text-xs"
            id="feedback-tenant-filter"
            onChange={(event) => {
              const value = event.target.value;
              setTenantId(value);
              setOffset(0);
              if (!value.trim() || ULID_PATTERN.test(value.trim())) {
                setLoading(true);
              }
            }}
            placeholder={m.common.optionalTenantUlid}
            value={tenantId}
          />
        </div>

        <div className="grid gap-2">
          <Label className="sr-only" htmlFor="feedback-assignee-filter">
            {m.feedbackTickets.assigneeId}
          </Label>
          <Input
            className="h-8 text-xs"
            id="feedback-assignee-filter"
            onChange={(event) => {
              const value = event.target.value;
              setAssigneeUserId(value);
              setOffset(0);
              if (!value.trim() || ULID_PATTERN.test(value.trim())) {
                setLoading(true);
              }
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

      <SaasTableSurface>
        {loading ? (
          <div className="grid gap-2 p-3">
            {[0, 1, 2, 3, 4].map((item) => (
              <div
                className="h-10 animate-pulse rounded-md bg-muted"
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
          <div className="overflow-x-auto">
            <Table className={saasCompactTableClassName}>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => {
                  const checked = selectedIds.has(ticket.id);
                  const sla = computeTicketSla(ticket);
                  const isUrgent = ticket.priority === "urgent";
                  const isOverdue = sla.status === "overdue";
                  const href = webAdminRoutes.saas.feedbackTicket(ticket.id);
                  // Urgent tickets get a red left edge; overdue ones get a
                  // destructive-tinted row. Both highlight together when both apply.
                  const rowAccent = cn(
                    isUrgent &&
                      "border-l-2 border-l-destructive/70 bg-destructive/5",
                    isOverdue && !isUrgent && "bg-amber-500/5",
                  );

                  return (
                    <TableRow
                      className={cn(
                        "cursor-pointer transition-colors",
                        rowAccent,
                      )}
                      data-priority={isUrgent ? "urgent" : undefined}
                      data-sla={sla.status}
                      key={ticket.id}
                      onClick={() => router.push(href)}
                      onMouseEnter={() => router.prefetch(href)}
                    >
                      <TableCell>
                        <Checkbox
                          aria-label={`${m.feedbackTickets.batch.selectAll}: ${ticket.title}`}
                          checked={checked}
                          onCheckedChange={(value) =>
                            toggleSelected(ticket.id, value === true)
                          }
                          onClick={(event) => event.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell>
                        <Link
                          className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          href={href}
                          onClick={(event) => event.stopPropagation()}
                          onFocus={() => router.prefetch(href)}
                        >
                          {ticket.title}
                        </Link>
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
                      <TableCell>
                        {ticket.tenantId ?? m.common.platform}
                      </TableCell>
                      <TableCell>
                        {ticket.assigneeUserId ??
                          m.common.roleLabels.unassigned}
                      </TableCell>
                      <TableCell>
                        {formatDateTime(ticket.createdAt) ||
                          m.common.invalidDate}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {!loading && !error ? (
          <Pagination
            currentPageCount={tickets.length}
            hasNext={hasNextPage}
            nextLabel={m.common.nextPage}
            offset={offset}
            onOffsetChange={(nextOffset) => {
              setLoading(true);
              setOffset(nextOffset);
            }}
            pageSize={PAGE_SIZE}
            previousLabel={m.common.previousPage}
          />
        ) : null}
      </SaasTableSurface>
    </section>
  );
}
