import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const optionalDateSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Expected a valid date string.",
  })
  .optional();

export const securityEventListQuerySchema = z.object({
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  eventType: z.string().trim().min(1).max(120).optional(),
  tenantId: z.string().regex(ULID_PATTERN).optional(),
  dateFrom: optionalDateSchema,
  dateTo: optionalDateSchema,
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const getSecurityEventParamsSchema = z.object({
  eventId: z.string().regex(ULID_PATTERN),
});
