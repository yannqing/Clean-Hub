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
 * Ticket item status transitions. Items track physical processing
 * (washing → done → ready_to_pick). An item can be reset back to washing
 * from `done` when rework is needed.
 */
const ITEM_TRANSITIONS: Record<ServiceTicketItemStatus, ServiceTicketItemStatus[]> =
  {
    washing: ["done"],
    done: ["ready_to_pick", "washing"],
    ready_to_pick: [],
  };

export function isAllowedItemTransition(
  from: ServiceTicketItemStatus,
  to: ServiceTicketItemStatus,
): boolean {
  return ITEM_TRANSITIONS[from].includes(to);
}
