import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const ulidSchema = z.string().regex(ULID_PATTERN);

export const tenantNoticeTypeSchema = z.enum(["system", "business"]);
export const tenantNoticePrioritySchema = z.enum([
  "low",
  "normal",
  "high",
  "critical",
]);
export const tenantNoticeReadStatusSchema = z.enum([
  "unread",
  "read",
  "archived",
]);

export const tenantNotificationListQuerySchema = z.object({
  noticeType: tenantNoticeTypeSchema.optional(),
  readStatus: tenantNoticeReadStatusSchema.optional(),
  priority: tenantNoticePrioritySchema.optional(),
  relatedType: z.string().trim().min(1).max(80).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const tenantNotificationDeliveryParamsSchema = z.object({
  deliveryId: ulidSchema,
});
