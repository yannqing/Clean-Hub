import assert from "node:assert/strict";

import { ticketReadyForPickupEvent } from "../../notifications/index.js";
import { isTicketSettlementComplete } from "./service-tickets.repository.js";
import {
  canEditTicket,
  canWorkTicketItems,
  isAllowedItemTransition,
  resolveTicketStatusFromItems,
} from "./service-tickets.state-machine.js";

assert.equal(
  isTicketSettlementComplete({
    itemCount: 0,
    billedItemCount: 0,
    paymentStatuses: [],
  }),
  false,
  "an empty ticket must not bypass payment settlement",
);

assert.equal(
  isTicketSettlementComplete({
    itemCount: 2,
    billedItemCount: 1,
    paymentStatuses: ["paid"],
  }),
  false,
  "all active ticket items must be billed before pickup",
);

assert.equal(
  isTicketSettlementComplete({
    itemCount: 2,
    billedItemCount: 2,
    paymentStatuses: ["paid", "unpaid"],
  }),
  false,
  "all linked orders must be paid before pickup",
);

assert.equal(
  isTicketSettlementComplete({
    itemCount: 2,
    billedItemCount: 2,
    paymentStatuses: ["paid", "paid"],
  }),
  true,
  "fully billed and paid tickets may be picked up",
);

assert.equal(
  isTicketSettlementComplete({
    itemCount: 1,
    billedItemCount: 1,
    paymentStatuses: ["refunded"],
  }),
  false,
  "a refunded order must not count as settled",
);

// --- editability ----------------------------------------------------------

for (const status of ["picked_up", "cancelled"] as const) {
  assert.equal(
    canEditTicket(status),
    false,
    `a ${status} ticket must be frozen against edits`,
  );
}
for (const status of ["draft", "pending", "in_progress", "exception"] as const) {
  assert.equal(canEditTicket(status), true, `a ${status} ticket stays editable`);
}

// Items are only processed once the ticket has been confirmed.
assert.equal(
  canWorkTicketItems("draft"),
  false,
  "a draft ticket must not have items processed",
);
assert.equal(canWorkTicketItems("in_progress"), true);

// --- item transitions -----------------------------------------------------

assert.equal(
  isAllowedItemTransition("ready_to_pick", "exception"),
  true,
  "a problem found on the shelf must be recordable",
);
assert.equal(
  isAllowedItemTransition("ready_to_pick", "washing"),
  true,
  "an item on the shelf can be sent back for rework",
);

// --- ticket status derived from items -------------------------------------

assert.deepEqual(
  resolveTicketStatusFromItems({
    ticketStatus: "in_progress",
    itemStatuses: ["ready_to_pick", "washing"],
  }),
  [],
  "one unfinished item holds the ticket back",
);

assert.deepEqual(
  resolveTicketStatusFromItems({
    ticketStatus: "in_progress",
    itemStatuses: ["ready_to_pick", "exception"],
  }),
  ["exception"],
  "an item exception raises the ticket",
);

assert.deepEqual(
  resolveTicketStatusFromItems({
    ticketStatus: "pending",
    itemStatuses: ["ready_to_pick"],
  }),
  ["in_progress", "ready_to_pick"],
  "a pending ticket reaches ready_to_pick through in_progress",
);

assert.deepEqual(
  resolveTicketStatusFromItems({
    ticketStatus: "exception",
    itemStatuses: ["ready_to_pick", "ready_to_pick"],
  }),
  ["in_progress", "ready_to_pick"],
  "repairing every item must release a ticket stuck in exception",
);

assert.deepEqual(
  resolveTicketStatusFromItems({
    ticketStatus: "picked_up",
    itemStatuses: ["ready_to_pick"],
  }),
  [],
  "a handed-over ticket is never moved by its items",
);

// The ready-for-pickup message is what tells a walk-in customer their garments
// are waiting; without it finished work sits on the shelf.
const readyEvent = ticketReadyForPickupEvent({
  tenantId: "tenant_1",
  branchId: "branch_1",
  customerId: "customer_1",
  ticketId: "ticket_1",
  ticketNo: "TK-0001",
  customerName: "Test Customer",
  expectedPickupAt: "2026-09-21T10:00:00.000Z",
});

assert.equal(readyEvent.name, "ticket.ready_for_pickup");
assert.equal(readyEvent.relatedType, "ticket");
assert.equal(readyEvent.relatedId, "ticket_1");
assert.equal(readyEvent.customerId, "customer_1");
assert.equal(readyEvent.payload?.ticketNo, "TK-0001");

// A ticket can leave and re-enter ready_to_pick when an item goes back for
// rework, so the key must not vary with anything that changes in between --
// otherwise the customer is told twice for one ticket.
assert.equal(
  readyEvent.idempotencyKey,
  ticketReadyForPickupEvent({
    tenantId: "tenant_1",
    branchId: "branch_1",
    customerId: "customer_1",
    ticketId: "ticket_1",
    ticketNo: "TK-0001-CHANGED",
    customerName: "Renamed Customer",
    expectedPickupAt: "2026-09-22T10:00:00.000Z",
  }).idempotencyKey,
  "re-entering ready_to_pick must not notify the customer a second time",
);

// It must stay distinct from the overdue chase for the same ticket.
assert.notEqual(
  readyEvent.idempotencyKey,
  `ticket.overdue:ticket_1`,
  "ready-for-pickup and overdue are different messages about one ticket",
);

// A ticket with no customer account cannot be notified; the caller guards on
// this, so the event must still carry the fields it needs when one exists.
assert.equal(
  ticketReadyForPickupEvent({
    tenantId: "tenant_1",
    branchId: "branch_1",
    customerId: "customer_1",
    ticketId: "ticket_2",
  }).payload?.ticketNo,
  "ticket_2",
  "a ticket with no number falls back to its id",
);

console.log("POS service ticket settlement smoke passed.");
