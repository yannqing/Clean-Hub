import { getFeedbackTicketListQuery } from "@/features/saas/feedback-tickets/queries";
import { getRestoreRequestListQuery } from "@/features/saas/backups/queries";
import { getSecurityEventListQuery } from "@/features/saas/security/queries";
import { getSaasOverviewQuery } from "@/features/saas/overview/queries";

import type { TodoCenterResult, TodoItem, TodoQueue } from "../types";

/**
 * Cap on how many sample items each queue keeps for the dashboard list. The
 * Counts come from the server's aggregate queries; lists are previews only.
 */
const QUEUE_SAMPLE_SIZE = 8;

/**
 * Aggregates the operator's actionable items into a single payload.
 *
 * Aggregate counts and a newest-first sample are fetched separately so
 * pagination limits never masquerade as the total number of pending items:
 *
 * - feedback tickets → `status` open / in_progress
 * - restore requests → `status` pending (awaiting review)
 * - security events  → `severity` high / critical
 *
 * A failed source is surfaced as an error, not a fabricated zero count.
 */
export async function getTodoCenterQuery(): Promise<TodoCenterResult> {
  const [overview, openTickets, inProgressTickets, restores, highEvents, criticalEvents] =
    await Promise.all([
      getSaasOverviewQuery(),
      getFeedbackTicketListQuery({
        status: "open",
        limit: QUEUE_SAMPLE_SIZE,
        offset: 0,
      }),
      getFeedbackTicketListQuery({
        status: "in_progress",
        limit: QUEUE_SAMPLE_SIZE,
        offset: 0,
      }),
      getRestoreRequestListQuery({
        status: "pending",
        limit: QUEUE_SAMPLE_SIZE,
        offset: 0,
      }),
      getSecurityEventListQuery({
        severity: "high",
        limit: QUEUE_SAMPLE_SIZE,
        offset: 0,
      }),
      getSecurityEventListQuery({
        severity: "critical",
        limit: QUEUE_SAMPLE_SIZE,
        offset: 0,
      }),
    ]);
  const securityEvents = [...highEvents, ...criticalEvents];

  return {
    feedbackTickets: buildQueue(
      "feedbackTickets",
      "feedbackTicket",
      [...openTickets, ...inProgressTickets],
      overview.todoCounts.feedbackTickets,
      (a, b) => compareIsoDesc(a.createdAt, b.createdAt),
    ),
    restoreRequests: buildQueue(
      "restoreRequests",
      "restoreRequest",
      restores,
      overview.todoCounts.restoreRequests,
      (a, b) => compareIsoDesc(a.createdAt, b.createdAt),
    ),
    securityEvents: buildQueue(
      "securityEvents",
      "securityEvent",
      securityEvents,
      overview.todoCounts.securityEvents,
      (a, b) => compareIsoDesc(a.createdAt, b.createdAt),
    ),
  };
}

function compareIsoDesc(a: string, b: string): number {
  return Date.parse(b) - Date.parse(a);
}

function buildQueue<T>(
  id: TodoQueue["id"],
  kind: TodoItem["kind"],
  raw: readonly T[],
  count: number,
  compare: (a: T, b: T) => number,
): TodoQueue {
  const sorted = [...raw].sort(compare);
  const items: TodoItem[] = sorted
    .slice(0, QUEUE_SAMPLE_SIZE)
    // The discriminated-union field is the only variance; map each entry into
    // its tagged item so the dashboard can switch on `item.kind`.
    .map((data) => ({ kind, data: data }) as TodoItem);

  return {
    id,
    count,
    items,
  };
}
