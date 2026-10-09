import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const ulidSchema = z.string().regex(ULID_PATTERN);

export const posNoticeTypeSchema = z.enum(["system", "business"]);
export const posNoticePrioritySchema = z.enum([
  "low",
  "normal",
  "high",
  "critical",
]);
export const posNoticeReadStatusSchema = z.enum([
  "unread",
  "read",
  "archived",
]);
export const posNoticeRelatedTypeSchema = z.enum(["ticket", "order"]);

export const posNotificationListQuerySchema = z.object({
  noticeType: posNoticeTypeSchema.optional(),
  readStatus: posNoticeReadStatusSchema.optional(),
  priority: posNoticePrioritySchema.optional(),
  relatedType: posNoticeRelatedTypeSchema.optional(),
  q: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const posNotificationDeliveryParamsSchema = z.object({
  deliveryId: ulidSchema,
});
