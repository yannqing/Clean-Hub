import type {
  ServiceTicketItemStatus,
  ServiceTicketStatus,
} from "./service-tickets.types.js";

/**
 * Ticket (work order) status transitions.
 *
 * Mirrors the milestone state diagram:
 *
 *   draft         → pending | cancelled
 *   pending       → in_progress | cancelled
 *   in_progress   → ready_to_pick | exception
 *   ready_to_pick → picked_up | exception   (picked_up requires settlement)
 *   exception     → in_progress | cancelled
 *   picked_up     → (terminal)
 *   cancelled     → (terminal)
 *
 * The `ready_to_pick → picked_up` transition additionally requires the related
 * order to be settled (paid). That business check lives in the service layer;
 * the state machine only validates that the transition itself is allowed.
 */
const TICKET_TRANSITIONS: Record<ServiceTicketStatus, ServiceTicketStatus[]> =
  {
    draft: ["pending", "cancelled"],
    pending: ["in_progress", "cancelled"],
    in_progress: ["ready_to_pick", "exception"],
    ready_to_pick: ["picked_up", "exception"],
    exception: ["in_progress", "cancelled"],
    picked_up: [],
    cancelled: [],
  };

export function isTerminalTicketStatus(
  status: ServiceTicketStatus,
): boolean {
  return TICKET_TRANSITIONS[status].length === 0;
}

export function isAllowedTicketTransition(
  from: ServiceTicketStatus,
  to: ServiceTicketStatus,
): boolean {
  return TICKET_TRANSITIONS[from].includes(to);
}

/**
 * Whether the `ready_to_pick → picked_up` transition requires the related
 * order to be settled before the transition can complete. The milestone
 * explicitly requires this check ("待取件状态到已取件需校验订单已结算").
 */
export function requiresSettlementCheck(
  from: ServiceTicketStatus,
  to: ServiceTicketStatus,
): boolean {
  return from === "ready_to_pick" && to === "picked_up";
}

/**
 * Ticket item status transitions. Items track physical processing:
 *
 *   pending_wash  → washing
 *   washing       → done | exception
 *   done          → ready_to_pick | washing  (rework)
 *   exception     → washing                  (retry)
 *   ready_to_pick → washing | exception      (problem found at the shelf)
 *
 * An item on the pickup shelf can still turn out to be unfinished, so
 * ready_to_pick is not terminal: staff can send it back for rework or flag it.
 */
const ITEM_TRANSITIONS: Record<ServiceTicketItemStatus, ServiceTicketItemStatus[]> =
  {
    pending_wash: ["washing"],
    washing: ["done", "exception"],
    done: ["ready_to_pick", "washing"],
    exception: ["washing"],
    ready_to_pick: ["washing", "exception"],
  };

export function isAllowedItemTransition(
  from: ServiceTicketItemStatus,
  to: ServiceTicketItemStatus,
): boolean {
  return ITEM_TRANSITIONS[from].includes(to);
}

/**
 * Ticket statuses whose items are still being worked on. Outside these the
 * ticket is a draft, cancelled, or already handed over, and its items must not
 * move: a draft has not been confirmed with the customer yet, and the other two
 * are settled history.
 */
const ITEM_WORKABLE_TICKET_STATUSES: ReadonlySet<ServiceTicketStatus> =
  new Set<ServiceTicketStatus>([
    "pending",
    "in_progress",
    "ready_to_pick",
    "exception",
  ]);

export function canWorkTicketItems(status: ServiceTicketStatus): boolean {
  return ITEM_WORKABLE_TICKET_STATUSES.has(status);
}

/**
 * The ticket status implied by its items, or null when the ticket should stay
 * where it is. Every item ready means the whole ticket is ready; any item in
 * exception raises the ticket so the problem is visible on the board.
 *
 * Returns the full path to walk, because a ticket sitting in `pending` cannot
 * jump straight to `ready_to_pick` — it has to pass through `in_progress`.
 */
export function resolveTicketStatusFromItems(input: {
  ticketStatus: ServiceTicketStatus;
  itemStatuses: readonly ServiceTicketItemStatus[];
}): ServiceTicketStatus[] {
  const { itemStatuses, ticketStatus } = input;
  if (itemStatuses.length === 0) return [];
  if (!canWorkTicketItems(ticketStatus)) return [];

  const target: ServiceTicketStatus | null = itemStatuses.some(
    (status) => status === "exception",
  )
    ? "exception"
    : itemStatuses.every((status) => status === "ready_to_pick")
      ? "ready_to_pick"
      : null;

  if (!target || target === ticketStatus) return [];

  if (isAllowedTicketTransition(ticketStatus, target)) return [target];

  // pending has no direct edge to ready_to_pick or exception; both are reached
  // once the ticket is actually in progress.
  if (
    ticketStatus === "pending" &&
    isAllowedTicketTransition("in_progress", target)
  ) {
    return ["in_progress", target];
  }

  return [];
}
