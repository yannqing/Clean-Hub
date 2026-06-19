import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export const serviceBusinessLineSchema = z.enum([
  "laundry",
  "car_wash",
  "retail",
  "delivery",
]);

export const servicePricingUnitSchema = z.enum(["per_item", "per_kg"]);
export const serviceStatusSchema = z.enum(["active", "inactive"]);

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
  categoryId: z.string().regex(ULID_PATTERN).nullable().optional(),
  pricingUnit: servicePricingUnitSchema,
  status: serviceStatusSchema.default("active"),
});

export const updateServiceBodySchema = createServiceBodySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one service field must be provided.",
);

export const updateServiceStatusBodySchema = z.object({
  status: serviceStatusSchema,
});
