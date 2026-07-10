import type { FeedbackTicketListItem, FeedbackTicketStatus } from "./types";

/**
 * Pure front-end SLA estimation for feedback tickets.
 *
 * The SaaS feedback ticket API does not yet expose a server-computed
 * `sla_deadline` field, so this module derives a best-effort deadline from the
 * ticket's `createdAt` and `priority`. The deadline window mirrors typical
 * support SLAs by priority; `urgent` tickets get a near-real-time window while
 * `low` tickets get a few days. These constants are centralized here so the
 * whole module (list highlighting, badges, detail view) stays consistent and
 * is easy to replace with a server-provided deadline later.
 *
 * Terminal-status tickets (resolved / closed) are always considered to have
 * met the SLA regardless of the computed deadline.
 */
export const SLA_DEADLINE_HOURS: Readonly<Record<string, number>> = {
  urgent: 4,
  high: 24,
  medium: 48,
  low: 72,
};

export const SLA_DEFAULT_HOURS = SLA_DEADLINE_HOURS.medium;
/** A ticket is treated as "due soon" when less than this many hours remain. */
export const SLA_DUE_SOON_HOURS = 4;

const TERMINAL_STATUSES = new Set<FeedbackTicketStatus>([
  "resolved",
  "closed",
]);

export type SlaStatus = "met" | "overdue" | "due_soon" | "on_track";

export type SlaResult = {
  /** Epoch milliseconds of the computed deadline. `null` when undeterminable. */
  deadline: number | null;
  status: SlaStatus;
};

function resolveDeadlineHours(priority: string): number {
  return SLA_DEADLINE_HOURS[priority] ?? SLA_DEFAULT_HOURS;
}

/**
 * Computes the SLA deadline and remaining-time status for a ticket based on
 * `createdAt` + `priority`. Returns `status: "met"` for terminal tickets.
 */
export function computeTicketSla(
  ticket: Pick<
    FeedbackTicketListItem,
    "createdAt" | "priority" | "status"
  >,
  now: number = Date.now(),
): SlaResult {
  if (TERMINAL_STATUSES.has(ticket.status)) {
    return { deadline: null, status: "met" };
  }

  const createdAtMs = Date.parse(ticket.createdAt);

  if (Number.isNaN(createdAtMs)) {
    return { deadline: null, status: "on_track" };
  }

  const deadline =
    createdAtMs + resolveDeadlineHours(ticket.priority) * 60 * 60 * 1000;
  const remainingHours = (deadline - now) / (60 * 60 * 1000);

  if (remainingHours <= 0) {
    return { deadline, status: "overdue" };
  }

  if (remainingHours <= SLA_DUE_SOON_HOURS) {
    return { deadline, status: "due_soon" };
  }

  return { deadline, status: "on_track" };
}

/**
 * Formats the remaining (or elapsed) time for an SLA status into a compact,
 * human-readable string such as "2h left" or "1d overdue".
 *
 * The caller passes the copy fragments so this helper stays free of i18n
 * coupling (mirrors the `Pagination` component convention).
 */
export function formatSlaRemaining(
  sla: SlaResult,
  now: number = Date.now(),
  labels: {
    met: string;
    onTrack: string;
    left: string;
    overdue: string;
    lessThanHourLeft: string;
  },
): string {
  if (sla.status === "met") {
    return labels.met;
  }

  if (sla.status === "on_track") {
    return labels.onTrack;
  }

  if (sla.deadline == null) {
    return labels.onTrack;
  }

  const diffMs = sla.deadline - now;
  const isOverdue = sla.status === "overdue";
  const absoluteMs = Math.abs(diffMs);
  const absoluteHours = absoluteMs / (60 * 60 * 1000);

  let formatted: string;

  if (absoluteHours >= 24) {
    const days = Math.floor(absoluteHours / 24);
    formatted = `${days}d`;
  } else if (absoluteHours >= 1) {
    const hours = Math.floor(absoluteHours);
    formatted = `${hours}h`;
  } else {
    formatted = isOverdue ? labels.overdue : labels.lessThanHourLeft;
  }

  return isOverdue ? `${formatted} ${labels.overdue}` : `${formatted} ${labels.left}`;
}
