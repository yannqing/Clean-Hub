import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const ulidSchema = z.string().regex(ULID_PATTERN);

export const posOrderStatusSchema = z.enum([
  "draft",
  "received",
  "paid",
  "delivered",
  "cancelled",
]);

export const posOrderPaymentStatusSchema = z.enum([
  "unpaid",
  "paid",
  "partial",
  "refunded",
]);

export const posOrderTypeSchema = z.enum(["ticket", "manual"]);

export const posOrderItemSourceTypeSchema = z.enum([
  "subscription",
  "delivery_fee",
  "product",
]);

export const posPaymentMethodSchema = z.enum(["cash", "card", "app"]);

export const posMobileMoneyProviderSchema = z.enum(["wave", "orange_money"]);

const amountSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a decimal with up to 2 places.")
  .refine((value) => Number(value) > 0, "Amount must be greater than zero.");

const quantitySchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,3})?$/, "Quantity must be a decimal with up to 3 places.")
  .refine((value) => Number(value) > 0, "Quantity must be greater than zero.");

const isoTimestampSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid ISO timestamp.");

const statusFilterSchema = z
  .union([posOrderStatusSchema, z.array(posOrderStatusSchema)])
  .transform((value) => (Array.isArray(value) ? value : [value]));

export const posOrderListQuerySchema = z.object({
  status: statusFilterSchema.optional(),
  paymentStatus: posOrderPaymentStatusSchema.optional(),
  orderType: posOrderTypeSchema.optional(),
  customerId: ulidSchema.optional(),
  branchId: ulidSchema.optional(),
  q: z.string().trim().min(1).max(120).optional(),
  createdAfter: isoTimestampSchema.optional(),
  createdBefore: isoTimestampSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const posOrderParamsSchema = z.object({
  orderId: ulidSchema,
});

export const posOrderItemParamsSchema = z.object({
  orderId: ulidSchema,
  itemId: ulidSchema,
});

const createManualOrderItemBodySchema = z.object({
  sourceType: posOrderItemSourceTypeSchema,
  sourceId: ulidSchema.optional(),
  itemName: z.string().trim().min(1).max(200),
  quantity: quantitySchema,
  unitAmount: amountSchema,
});

export const createPosOrderBodySchema = z.discriminatedUnion("orderType", [
  z.object({
    orderType: z.literal("ticket"),
    ticketId: ulidSchema,
    ticketItemIds: z.array(ulidSchema).min(1).max(100).optional(),
    expireAt: isoTimestampSchema.nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  }),
  z.object({
    orderType: z.literal("manual"),
    branchId: ulidSchema,
    customerId: ulidSchema,
    items: z.array(createManualOrderItemBodySchema).min(1).max(100),
    expireAt: isoTimestampSchema.nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  }),
]);

export const updatePosOrderBodySchema = z
  .object({
    orderType: posOrderTypeSchema.optional(),
    expireAt: isoTimestampSchema.nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    version: z.number().int().min(1),
  })
  .refine(
    (value) =>
      value.orderType !== undefined ||
      value.expireAt !== undefined ||
      value.notes !== undefined,
    "At least one order field must be provided.",
  );

export const changePosOrderStatusBodySchema = z.object({
  to: posOrderStatusSchema,
  note: z.string().trim().max(2000).optional(),
  version: z.number().int().min(1),
});

const idempotencyKeySchema = z.string().trim().min(1).max(120);

export const createPosPaymentBodySchema = z.discriminatedUnion(
  "paymentMethod",
  [
    z.object({
      paymentMethod: z.literal("cash"),
      amount: amountSchema,
      idempotencyKey: idempotencyKeySchema.optional(),
    }),
    z.object({
      paymentMethod: z.literal("app"),
      amount: amountSchema,
      provider: posMobileMoneyProviderSchema,
      externalReference: z.string().trim().min(3).max(120),
      idempotencyKey: idempotencyKeySchema,
    }),
  ],
);

export const resolvePosPaymentBodySchema = z.object({
  reason: z.string().trim().min(3).max(500).optional(),
});

export const failPosPaymentBodySchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const posPaymentParamsSchema = posOrderParamsSchema.extend({
  paymentId: ulidSchema,
});

export const createPosOrderItemBodySchema = createManualOrderItemBodySchema;

export const updatePosOrderItemBodySchema = z
  .object({
    itemName: z.string().trim().min(1).max(200).optional(),
    quantity: quantitySchema.optional(),
    unitAmount: amountSchema.optional(),
    version: z.number().int().min(1),
  })
  .refine(
    (value) =>
      value.itemName !== undefined ||
      value.quantity !== undefined ||
      value.unitAmount !== undefined,
    "At least one item field must be provided.",
  );

export const posOrderOverviewQuerySchema = z.object({
  period: z.enum(["all", "today", "week", "month"]).default("today"),
  branchId: ulidSchema.optional(),
});
