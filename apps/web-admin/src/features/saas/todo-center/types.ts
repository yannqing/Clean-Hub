import type {
  FeedbackTicketListItem,
  RestoreRequest,
  SecurityEventListItem,
} from "@cleanhub/api-client";

/**
 * The three queues the "My Todo" center aggregates. Each maps to an existing
 * module the operator already manages individually; this center just rolls
 * their actionable items into one view.
 *
 * - `feedbackTickets`  → tickets still in an open / in-progress state
 * - `restoreRequests`  → restore requests awaiting review (status `pending`)
 * - `securityEvents`   → high-severity security events needing attention
 */
export type TodoQueueId =
  | "feedbackTickets"
  | "restoreRequests"
  | "securityEvents";

export type TodoQueue = {
  id: TodoQueueId;
  /** Number of actionable items currently in this queue. */
  count: number;
  /** Sample of the most recent items (newest first), for the dashboard list. */
  items: TodoItem[];
};

export type TodoItem =
  | {
      kind: "feedbackTicket";
      data: FeedbackTicketListItem;
    }
  | {
      kind: "restoreRequest";
      data: RestoreRequest;
    }
  | {
      kind: "securityEvent";
      data: SecurityEventListItem;
    };

/** Result of {@link getTodoCenterQuery}: all three queues, or a load error. */
export type TodoCenterResult = {
  feedbackTickets: TodoQueue;
  restoreRequests: TodoQueue;
  securityEvents: TodoQueue;
};

/** Total actionable items across every queue (for the header badge). */
export function todoCenterTotal(result: TodoCenterResult): number {
  return (
    result.feedbackTickets.count +
    result.restoreRequests.count +
    result.securityEvents.count
  );
}
