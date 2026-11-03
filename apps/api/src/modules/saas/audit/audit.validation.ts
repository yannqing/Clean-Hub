import { z } from "zod";

const ulidSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);

export const listAuditLogsQuerySchema = z.object({
  tenantId: ulidSchema.optional(),
  actorUserId: ulidSchema.optional(),
  eventCategory: z.string().trim().min(1).max(80).optional(),
  eventType: z.string().trim().min(1).max(120).optional(),
  entityType: z.string().trim().min(1).max(80).optional(),
  entityId: ulidSchema.optional(),
  success: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const getAuditLogParamsSchema = z.object({
  logId: ulidSchema,
});
