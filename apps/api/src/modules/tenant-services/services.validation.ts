import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export const serviceBusinessLineSchema = z.enum([
  "laundry",
  "dry_cleaning",
  "pressing",
  "car_wash",
  "retail_products",
]);

export const servicePricingModeSchema = z.enum(["per_item", "per_kg"]);
export const serviceStatusSchema = z.enum(["active", "disabled"]);

export const serviceListQuerySchema = z.object({
  businessLine: serviceBusinessLineSchema.optional(),
  status: serviceStatusSchema.optional(),
  q: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const serviceParamsSchema = z.object({
  serviceId: z.string().regex(ULID_PATTERN),
});

export const createServiceBodySchema = z.object({
  businessLine: serviceBusinessLineSchema,
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  pricingMode: servicePricingModeSchema,
  status: serviceStatusSchema.default("active"),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export const updateServiceBodySchema = createServiceBodySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one service field must be provided.",
);
