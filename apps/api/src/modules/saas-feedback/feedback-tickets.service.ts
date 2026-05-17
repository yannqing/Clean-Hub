import { getDb, type Database } from "@cleanhub/db";

import { AuthError } from "../auth/auth.errors.js";
import type { AuthContext } from "../auth/auth.types.js";
import { requireSaasRole } from "../auth/permission.helper.js";
import { FeedbackTicketsError } from "./feedback-tickets.errors.js";
import {
  findFeedbackTicketDetailById,
  findFeedbackTickets,
} from "./feedback-tickets.repository.js";
import type {
  FeedbackTicketDetail,
  FeedbackTicketListInput,
  FeedbackTicketListItem,
} from "./feedback-tickets.types.js";

function requireFeedbackTicketReadAccess(authContext: AuthContext): void {
  requireSaasRole(authContext, ["super_admin", "support"]);

  if (authContext.tenantId !== null) {
    throw new AuthError(
      "FORBIDDEN",
      "Tenant users cannot access SaaS feedback tickets.",
    );
  }
}

export async function listFeedbackTickets(
  authContext: AuthContext,
  input: FeedbackTicketListInput,
  db: Database = getDb(),
): Promise<FeedbackTicketListItem[]> {
  requireFeedbackTicketReadAccess(authContext);

  return findFeedbackTickets(db, input);
}

export async function getFeedbackTicketDetail(
  authContext: AuthContext,
  ticketId: string,
  db: Database = getDb(),
): Promise<FeedbackTicketDetail> {
  requireFeedbackTicketReadAccess(authContext);

  const ticket = await findFeedbackTicketDetailById(db, ticketId);

  if (!ticket) {
    throw new FeedbackTicketsError(
      "FEEDBACK_TICKET_NOT_FOUND",
      "Feedback ticket was not found.",
      404,
    );
  }

  return ticket;
}
