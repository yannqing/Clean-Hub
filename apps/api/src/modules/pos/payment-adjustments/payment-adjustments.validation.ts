import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const ulidSchema = z.string().regex(ULID_PATTERN);
const amountSchema = z
  .string()
  .trim()
  .regex(/^\d{1,10}(?:\.\d{1,2})?$/)
  .refine((value) => Number(value) > 0, "Amount must be greater than zero.");
const reasonSchema = z.string().trim().min(1).max(500);

export const createPosRefundBodySchema = z.object({
  orderId: ulidSchema,
  originalPaymentId: ulidSchema,
  amount: amountSchema,
  idempotencyKey: z.string().trim().min(1).max(120),
  reason: reasonSchema,
});

export const createPosPaymentCorrectionBodySchema = z.object({
  orderId: ulidSchema,
  originalPaymentId: ulidSchema,
  direction: z.enum(["debit", "credit"]),
  amount: amountSchema,
  idempotencyKey: z.string().trim().min(1).max(120),
  reason: reasonSchema,
});

export const listPosPaymentAdjustmentsQuerySchema = z.object({
  orderId: ulidSchema,
});
