import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const ulidSchema = z.string().regex(ULID_PATTERN);

export const posOrderDiscountParamsSchema = z.object({
  orderId: ulidSchema,
});

export const posOrderDiscountApplicationParamsSchema =
  posOrderDiscountParamsSchema.extend({
    applicationId: ulidSchema,
  });

export const applyPosOrderDiscountBodySchema = z.union([
  z.object({
    code: z.string().trim().min(1).max(100),
    discountId: z.never().optional(),
    reason: z.string().trim().min(1).max(500),
    version: z.number().int().min(1),
    idempotencyKey: z.string().trim().min(1).max(120),
  }),
  z.object({
    code: z.never().optional(),
    discountId: ulidSchema,
    reason: z.string().trim().min(1).max(500),
    version: z.number().int().min(1),
    idempotencyKey: z.string().trim().min(1).max(120),
  }),
]);

export const removePosOrderDiscountBodySchema = z.object({
  version: z.number().int().min(1),
  reason: z.string().trim().min(1).max(500),
});
