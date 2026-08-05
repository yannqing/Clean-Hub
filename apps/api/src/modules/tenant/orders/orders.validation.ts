import { z } from "zod";

import {
  createPosOrderItemBodySchema,
  deletePosOrderItemBodySchema,
  updatePosOrderItemBodySchema,
} from "../../pos/orders/orders.validation.js";
import {
  createPosPaymentCorrectionBodySchema,
  createPosRefundBodySchema,
} from "../../pos/payment-adjustments/payment-adjustments.validation.js";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const ulidSchema = z.string().regex(ULID_PATTERN);

const isoTimestampSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => !Number.isNaN(Date.parse(value)),
    "Invalid ISO timestamp.",
  );

const importQuantitySchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "Quantity must be a positive whole number.")
  .refine((value) => Number(value) > 0, "Quantity must be greater than zero.");

const importWeightSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,3})?$/, "Weight must have up to 3 decimal places.")
  .refine((value) => Number(value) > 0, "Weight must be greater than zero.");

export const tenantOrderStatusSchema = z.enum([
  "draft",
  "received",
  "paid",
  "delivered",
  "cancelled",
]);

export const tenantOrderPaymentStatusSchema = z.enum([
  "unpaid",
  "paid",
  "partial",
  "refunded",
]);

export const tenantOrderTypeSchema = z.enum(["ticket", "manual"]);

export const tenantOrderSortSchema = z.enum([
  "created_desc",
  "created_asc",
  "amount_desc",
  "amount_asc",
]);

function withValidDateRange<TSchema extends z.ZodRawShape>(
  schema: z.ZodObject<TSchema>,
) {
  return schema.refine(
    (value) => {
      const range = value as {
        createdAfter?: string;
        createdBefore?: string;
      };

      return (
        !range.createdAfter ||
        !range.createdBefore ||
        Date.parse(range.createdAfter) < Date.parse(range.createdBefore)
      );
    },
    {
      message: "createdAfter must be earlier than createdBefore.",
      path: ["createdBefore"],
    },
  );
}

export const tenantOrderListQuerySchema = withValidDateRange(
  z.object({
    status: tenantOrderStatusSchema.optional(),
    paymentStatus: tenantOrderPaymentStatusSchema.optional(),
    orderType: tenantOrderTypeSchema.optional(),
    customerId: ulidSchema.optional(),
    branchId: ulidSchema.optional(),
    q: z.string().trim().min(1).max(120).optional(),
    createdAfter: isoTimestampSchema.optional(),
    createdBefore: isoTimestampSchema.optional(),
    sort: tenantOrderSortSchema.default("created_desc"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),
);

export const tenantOrderOverviewQuerySchema = withValidDateRange(
  z.object({
    period: z.enum(["all", "today", "week", "month"]).default("today"),
    branchId: ulidSchema.optional(),
    createdAfter: isoTimestampSchema.optional(),
    createdBefore: isoTimestampSchema.optional(),
  }),
);

export const tenantOrderParamsSchema = z.object({
  orderId: ulidSchema,
});

export const tenantOrderCommentParamsSchema = z.object({
  orderId: ulidSchema,
  commentId: ulidSchema,
});

export const tenantOrderItemParamsSchema = tenantOrderParamsSchema.extend({
  itemId: ulidSchema,
});

export const createTenantOrderItemBodySchema = createPosOrderItemBodySchema;
export const updateTenantOrderItemBodySchema = updatePosOrderItemBodySchema;
export const deleteTenantOrderItemBodySchema = deletePosOrderItemBodySchema;

export const createTenantOrderRefundBodySchema = createPosRefundBodySchema.omit(
  { orderId: true },
);
export const createTenantOrderPaymentCorrectionBodySchema =
  createPosPaymentCorrectionBodySchema.omit({ orderId: true });

export const tenantOrderTimelineQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const createTenantOrderCommentBodySchema = z.object({
  body: z.string().trim().min(1).max(2000),
  idempotencyKey: z.string().trim().min(1).max(120),
  mentionedUserIds: z.array(ulidSchema).max(20).default([]),
  attachments: z
    .array(
      z.object({
        objectKey: z.string().trim().min(1).max(1024),
        fileName: z.string().trim().min(1).max(255),
      }),
    )
    .max(5)
    .default([]),
});

export const tenantOrderAttachmentUploadBodySchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024),
});

export const updateTenantOrderCommentBodySchema = z.object({
  body: z.string().trim().min(1).max(2000),
  version: z.number().int().min(1),
  mentionedUserIds: z.array(ulidSchema).max(20).default([]),
});

export const deleteTenantOrderCommentBodySchema = z.object({
  version: z.number().int().min(1),
});

export const changeTenantOrderStatusBodySchema = z.object({
  to: z.enum(["received", "delivered", "cancelled"]),
  note: z.string().trim().max(2000).optional(),
  reason: z.string().trim().min(1).max(500).optional(),
  version: z.number().int().min(1),
});

export const createTenantOrderPaymentBodySchema = z.object({
  paymentMethod: z.literal("cash"),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/)
    .refine((value) => Number(value) > 0),
  idempotencyKey: z.string().trim().min(1).max(120),
});

const tenantOrderImportItemSchema = z
  .object({
    serviceId: ulidSchema,
    quantity: importQuantitySchema.optional(),
    weight: importWeightSchema.optional(),
    bagCount: z.number().int().min(1).max(9999).optional(),
  })
  .refine((item) => item.quantity !== undefined || item.weight !== undefined, {
    message: "Either quantity or weight is required.",
  });

export const tenantOrderImportBodySchema = z
  .object({
    orders: z
      .array(
        z.object({
          id: ulidSchema,
          importKey: z.string().trim().min(1).max(120),
          branchId: ulidSchema,
          customerId: ulidSchema,
          notes: z.string().trim().max(2000).optional(),
          expireAt: isoTimestampSchema.optional(),
          items: z.array(tenantOrderImportItemSchema).min(1).max(100),
        }),
      )
      .min(1)
      .max(100),
  })
  .refine(
    (data) =>
      data.orders.reduce((total, order) => total + order.items.length, 0) <=
      500,
    "An import can contain at most 500 item rows.",
  );
