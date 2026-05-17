import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export const feedbackTicketListQuerySchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  priority: z.string().trim().min(1).max(32).optional(),
  tenantId: z.string().regex(ULID_PATTERN).optional(),
  assigneeUserId: z.string().regex(ULID_PATTERN).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const feedbackTicketParamsSchema = z.object({
  ticketId: z.string().regex(ULID_PATTERN),
});
