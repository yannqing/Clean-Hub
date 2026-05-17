import { getDb, type Database } from "@cleanhub/db";

import { AuthError } from "../auth/auth.errors.js";
import type { AuthContext, AuthRequestMeta } from "../auth/auth.types.js";
import { requireSaasRole } from "../auth/permission.helper.js";
import { writeAuditLog } from "../audit/audit.helper.js";
import { FeedbackTicketsError } from "./feedback-tickets.errors.js";
import {
  findFeedbackTicketDetailById,
  findFeedbackTicketStatusAuditSnapshotById,
  findFeedbackTickets,
  updateFeedbackTicketStatusRecord,
} from "./feedback-tickets.repository.js";
import type {
  FeedbackTicketDetail,
  FeedbackTicketListInput,
  FeedbackTicketListItem,
  UpdateFeedbackTicketStatusRequest,
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

export async function updateFeedbackTicketStatus(
  authContext: AuthContext,
  ticketId: string,
  data: UpdateFeedbackTicketStatusRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<FeedbackTicketDetail> {
  requireFeedbackTicketReadAccess(authContext);

  return db.transaction(async (tx) => {
    const before = await findFeedbackTicketStatusAuditSnapshotById(tx, ticketId);

    if (!before) {
      throw new FeedbackTicketsError(
        "FEEDBACK_TICKET_NOT_FOUND",
        "Feedback ticket was not found.",
        404,
      );
    }

    const updated = await updateFeedbackTicketStatusRecord(tx, {
      ticketId,
      status: data.status,
      actorUserId: authContext.userId,
    });

    if (!updated) {
      throw new FeedbackTicketsError(
        "FEEDBACK_TICKET_NOT_FOUND",
        "Feedback ticket was not found.",
        404,
      );
    }

    await writeAuditLog(tx, {
      actorUserId: authContext.userId,
      tenantId: before.tenantId,
      branchId: before.branchId,
      eventCategory: "saas_feedback",
      eventType: "feedback_ticket.status_updated",
      entityType: "feedback_ticket",
      entityId: ticketId,
      reason: data.reason,
      before: {
        status: before.status,
      },
      after: {
        status: updated.status,
      },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    return updated;
  });
}
