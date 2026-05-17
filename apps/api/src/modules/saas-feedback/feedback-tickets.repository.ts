import { and, desc, eq, isNull } from "drizzle-orm";

import { feedbackTickets, type Database } from "@cleanhub/db";

import type {
  FeedbackTicketListInput,
  FeedbackTicketListItem,
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
