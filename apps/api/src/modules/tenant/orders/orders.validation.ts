import { z } from "zod";

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
