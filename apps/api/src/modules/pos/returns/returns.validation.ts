import { z } from "zod";

const ulid = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
const quantity = z
  .string()
  .regex(/^\d+(\.\d{1,3})?$/)
  .refine((value) => Number(value) > 0);

export const createPosProductReturnBodySchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(3).max(500),
  notes: z.string().trim().max(2000).optional(),
  items: z
    .array(
      z.object({
        orderItemId: ulid,
        quantity,
        condition: z.enum([
          "unopened",
          "good",
          "damaged",
          "defective",
          "unknown",
        ]),
        disposition: z.enum(["restock", "damaged", "discarded", "exchange"]),
        reason: z.string().trim().max(500).optional(),
      }),
    )
    .min(1)
    .max(100),
  /**
   * Provider settlement references, keyed by the payment being refunded.
   *
   * The amounts themselves are NOT accepted from the client: how much of a
   * refund each payment can absorb is decided server-side against that
   * payment's remaining refundable balance. A caller may only tell us that a
   * non-cash refund has already settled, and with which provider reference.
   */
  refundSettlements: z
    .array(
      z.object({
        originalPaymentId: ulid,
        settlementReference: z.string().trim().min(1).max(160),
      }),
    )
    .max(10)
    .optional(),
  exchangeItems: z
    .array(z.object({ productSkuId: ulid, quantity }))
    .min(1)
    .max(100)
    .optional(),
});
