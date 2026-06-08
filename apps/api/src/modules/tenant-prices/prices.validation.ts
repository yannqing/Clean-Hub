import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export const priceBusinessLineSchema = z.enum([
  "laundry",
  "car_wash",
  "retail",
  "delivery",
]);

export const priceStatusSchema = z.enum(["active", "inactive"]);

export const priceListQuerySchema = z.object({
  businessLine: priceBusinessLineSchema.optional(),
  status: priceStatusSchema.optional(),
  q: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const priceParamsSchema = z.object({
  priceId: z.string().regex(ULID_PATTERN),
});

export const updatePriceBodySchema = z
  .object({
    amount: z
      .union([z.string(), z.number()])
      .transform((value) => String(value).trim())
      .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), {
        message: "Amount must be a positive decimal with up to 2 decimals.",
      })
      .refine((value) => Number(value) > 0, {
        message: "Amount must be greater than 0.",
      })
      .optional(),
    currency: z.string().trim().length(3).toUpperCase().optional(),
    status: priceStatusSchema.optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one price field must be provided.",
  );
