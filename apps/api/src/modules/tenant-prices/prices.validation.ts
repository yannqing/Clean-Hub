import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export const priceBusinessLineSchema = z.enum([
  "laundry",
  "dry_cleaning",
  "pressing",
  "car_wash",
  "retail_products",
]);

export const priceBookStatusSchema = z.enum(["active", "disabled", "draft"]);

const nullableDateSchema = z
  .string()
  .trim()
  .date()
  .nullable()
  .optional();

export const priceBookListQuerySchema = z.object({
  businessLine: priceBusinessLineSchema.optional(),
  status: priceBookStatusSchema.optional(),
  branchId: z.string().regex(ULID_PATTERN).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const priceBookParamsSchema = z.object({
  priceBookId: z.string().regex(ULID_PATTERN),
});

export const createPriceBookBodySchema = z.object({
  businessLine: priceBusinessLineSchema,
  name: z.string().trim().min(1).max(120),
  currency: z.string().trim().length(3).toUpperCase(),
  status: priceBookStatusSchema.default("draft"),
  branchId: z.string().regex(ULID_PATTERN).nullable().optional(),
  effectiveFrom: nullableDateSchema,
  effectiveTo: nullableDateSchema,
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export const updatePriceBookBodySchema = createPriceBookBodySchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one price book field must be provided.",
  );
