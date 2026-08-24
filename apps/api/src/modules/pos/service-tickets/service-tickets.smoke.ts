import assert from "node:assert/strict";

import { isTicketSettlementComplete } from "./service-tickets.repository.js";

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

console.log("POS service ticket settlement smoke passed.");
