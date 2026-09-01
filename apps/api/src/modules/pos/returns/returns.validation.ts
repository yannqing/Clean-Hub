import { z } from "zod";

const ulid = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
const amount = z.string().regex(/^\d+(\.\d{1,2})?$/).refine((value) => Number(value) > 0);
const quantity = z.string().regex(/^\d+(\.\d{1,3})?$/).refine((value) => Number(value) > 0);

export const createPosProductReturnBodySchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(3).max(500),
  notes: z.string().trim().max(2000).optional(),
  items: z
    .array(
      z.object({
        orderItemId: ulid,
        quantity,
        condition: z.enum(["unopened", "good", "damaged", "defective", "unknown"]),
        disposition: z.enum(["restock", "damaged", "discarded", "exchange"]),
        reason: z.string().trim().max(500).optional(),
      }),
    )
    .min(1)
    .max(100),
  refundAllocations: z
    .array(z.object({ originalPaymentId: ulid, amount }))
    .max(10)
    .optional(),
  exchangeItems: z
    .array(z.object({ productSkuId: ulid, quantity }))
    .min(1)
    .max(100)
    .optional(),
});
