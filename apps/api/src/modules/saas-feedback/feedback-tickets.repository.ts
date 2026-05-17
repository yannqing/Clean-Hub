import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { feedbackTickets, type Database } from "@cleanhub/db";

import type {
  FeedbackTicketDetail,
  FeedbackTicketListInput,
  FeedbackTicketListItem,
  FeedbackTicketStatus,
  FeedbackTicketStatusAuditSnapshot,
} from "./feedback-tickets.types.js";

export async function findFeedbackTickets(
  db: Database,
  input: FeedbackTicketListInput,
): Promise<FeedbackTicketListItem[]> {
  const rows = await db
    .select({
      id: feedbackTickets.id,
      tenantId: feedbackTickets.tenantId,
      branchId: feedbackTickets.branchId,
      title: feedbackTickets.title,
      status: feedbackTickets.status,
      priority: feedbackTickets.priority,
      source: feedbackTickets.source,
      reporterUserId: feedbackTickets.reporterUserId,
      assigneeUserId: feedbackTickets.assigneeUserId,
      createdAt: feedbackTickets.createdAt,
      updatedAt: feedbackTickets.updatedAt,
    })
    .from(feedbackTickets)
    .where(
      and(
        isNull(feedbackTickets.deletedAt),
        input.status ? eq(feedbackTickets.status, input.status) : undefined,
        input.priority ? eq(feedbackTickets.priority, input.priority) : undefined,
        input.tenantId ? eq(feedbackTickets.tenantId, input.tenantId) : undefined,
        input.assigneeUserId
          ? eq(feedbackTickets.assigneeUserId, input.assigneeUserId)
          : undefined,
      ),
    )
    .orderBy(desc(feedbackTickets.createdAt))
    .limit(input.limit)
    .offset(input.offset);

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function findFeedbackTicketDetailById(
  db: Database,
  ticketId: string,
): Promise<FeedbackTicketDetail | null> {
  const rows = await db
    .select({
      id: feedbackTickets.id,
      tenantId: feedbackTickets.tenantId,
      branchId: feedbackTickets.branchId,
      title: feedbackTickets.title,
      description: feedbackTickets.description,
      status: feedbackTickets.status,
      priority: feedbackTickets.priority,
      source: feedbackTickets.source,
      reporterUserId: feedbackTickets.reporterUserId,
      assigneeUserId: feedbackTickets.assigneeUserId,
      metadata: feedbackTickets.metadata,
      createdAt: feedbackTickets.createdAt,
      updatedAt: feedbackTickets.updatedAt,
      createdBy: feedbackTickets.createdBy,
      updatedBy: feedbackTickets.updatedBy,
    })
    .from(feedbackTickets)
    .where(
      and(
        eq(feedbackTickets.id, ticketId),
        isNull(feedbackTickets.deletedAt),
      ),
    )
    .limit(1);

  const ticket = rows[0];

  if (!ticket) {
    return null;
  }

  return {
    ...ticket,
    metadata: ticket.metadata ?? null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

export async function findFeedbackTicketStatusAuditSnapshotById(
  db: Database,
  ticketId: string,
): Promise<FeedbackTicketStatusAuditSnapshot | null> {
  const rows = await db
    .select({
      tenantId: feedbackTickets.tenantId,
      branchId: feedbackTickets.branchId,
      status: feedbackTickets.status,
    })
    .from(feedbackTickets)
    .where(
      and(
        eq(feedbackTickets.id, ticketId),
        isNull(feedbackTickets.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function updateFeedbackTicketStatusRecord(
  db: Database,
  input: {
    ticketId: string;
    status: FeedbackTicketStatus;
    actorUserId: string;
  },
): Promise<FeedbackTicketDetail | null> {
  const now = new Date();
  const rows = await db
    .update(feedbackTickets)
    .set({
      status: input.status,
      updatedAt: now,
      updatedBy: input.actorUserId,
      version: sql`${feedbackTickets.version} + 1`,
    })
    .where(
      and(
        eq(feedbackTickets.id, input.ticketId),
        isNull(feedbackTickets.deletedAt),
      ),
    )
    .returning({
      id: feedbackTickets.id,
    });

  if (!rows[0]) {
    return null;
  }

  return findFeedbackTicketDetailById(db, input.ticketId);
}
