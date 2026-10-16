import { z } from "zod";

import {
  createPosCheckoutBodySchema,
  createPosPaymentBodySchema,
} from "../orders/orders.validation.js";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const ulidSchema = z.string().regex(ULID_PATTERN);

export const reportPosOfflineSaleExceptionBodySchema = z.object({
  commandId: z.string().trim().min(1).max(120),
  orderId: ulidSchema,
  command: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("checkout"),
      input: createPosCheckoutBodySchema,
    }),
    z.object({
      type: z.literal("payment"),
      orderId: ulidSchema,
      input: createPosPaymentBodySchema,
    }),
  ]),
  failureCode: z.string().trim().min(1).max(80).optional(),
  failureMessage: z.string().trim().min(1).max(2000),
});

export const posOfflineSaleExceptionParamsSchema = z.object({
  commandId: z.string().trim().min(1).max(120),
});

export const listPosOfflineSaleExceptionsQuerySchema = z.object({
  status: z.enum(["open", "resolved"]).default("open"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const resolvePosOfflineSaleExceptionBodySchema = z.object({
  action: z.enum(["cash_refunded", "retry_latest"]),
  reason: z.string().trim().min(1).max(500),
});
