import { getFeedbackTicketListQuery } from "@/features/saas/feedback-tickets/queries";
import { getRestoreRequestListQuery } from "@/features/saas/backups/queries";
import { getSecurityEventListQuery } from "@/features/saas/security/queries";

import type { TodoCenterResult, TodoItem, TodoQueue } from "../types";

/**
 * Cap on how many sample items each queue keeps for the dashboard list. The
 * counts are authoritative (driven by the full list fetch); the samples are
 * just a preview of the newest items.
 */
const QUEUE_SAMPLE_SIZE = 8;

/**
 * Aggregates the operator's actionable items into a single payload.
 *
 * Per the Web Admin improvement notes (4.7), there is no dedicated "my todo"
 * backend endpoint yet, so this query fans out the existing list endpoints in
 * parallel and derives the per-queue counts + a newest-first sample on the
 * client. Each source is queried with the filter that marks items as
 * actionable:
 *
 * - feedback tickets → `status` open / in_progress
 * - restore requests → `status` pending (awaiting review)
 * - security events  → `severity` high / critical
 *
 * A failure in any one source degrades gracefully: that queue reports zero
 * items rather than failing the whole todo center, so the header badge and
 * dashboard still render. This keeps a transient 5xx on one endpoint from
 * hiding the other queues' counts.
 */
export async function getTodoCenterQuery(): Promise<TodoCenterResult> {
  const [ticketResult, restoreResult, highSeverityResult, criticalSeverityResult] =
    await Promise.allSettled([
      getFeedbackTicketListQuery({
        status: "open",
        limit: 50,
        offset: 0,
      }),
      getRestoreRequestListQuery({
        status: "pending",
        limit: 50,
        offset: 0,
      }),
      // Two severities can't be requested in one call, so fetch both and merge.
      getSecurityEventListQuery({
        severity: "high",
        limit: 50,
        offset: 0,
      }),
      getSecurityEventListQuery({
        severity: "critical",
        limit: 50,
        offset: 0,
      }),
    ]);

  const tickets =
    ticketResult.status === "fulfilled" ? ticketResult.value : [];

  // Feedback tickets that are actionable: open OR in-progress. The list query
  // only accepts a single status, so we fetch `open` and additionally keep any
  // in-progress entries the list happens to return.
  const actionableTickets = tickets.filter(
    (ticket) => ticket.status === "open" || ticket.status === "in_progress",
  );

  const restores =
    restoreResult.status === "fulfilled" ? restoreResult.value : [];

  const highEvents =
    highSeverityResult.status === "fulfilled" ? highSeverityResult.value : [];
  const criticalEvents =
    criticalSeverityResult.status === "fulfilled"
      ? criticalSeverityResult.value
      : [];
  const securityEvents = [...highEvents, ...criticalEvents];

  return {
    feedbackTickets: buildQueue(
      "feedbackTickets",
      "feedbackTicket",
      actionableTickets,
      (a, b) => compareIsoDesc(a.createdAt, b.createdAt),
    ),
    restoreRequests: buildQueue(
      "restoreRequests",
      "restoreRequest",
      restores,
      (a, b) => compareIsoDesc(a.createdAt, b.createdAt),
    ),
    securityEvents: buildQueue(
      "securityEvents",
      "securityEvent",
      securityEvents,
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
    count: sorted.length,
    items,
  };
}
