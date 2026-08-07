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
export const serviceLabelRuleSchema = z.enum([
  "none",
  "per_item",
  "per_order_item",
  "per_bag",
]);

const standardPriceSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), {
    message: "Standard price must be a decimal with up to 2 places.",
  })
  .refine((value) => Number(value) > 0, {
    message: "Standard price must be greater than 0.",
  })
  .refine((value) => Number(value) <= 9_999_999_999.99, {
    message: "Standard price exceeds the supported maximum.",
  });
const optionalPriceSchema = standardPriceSchema.nullable().optional();
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

const serviceProfileBodySchema = z.object({
  businessLine: serviceBusinessLineSchema,
  name: z.string().trim().min(1).max(200),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9._-]{0,63}$/)
    .nullable()
    .optional(),
  shortName: z.string().trim().min(1).max(80).nullable().optional(),
  categoryId: z.string().regex(ULID_PATTERN),
  description: z.string().trim().max(2000).nullable().optional(),
  internalNotes: z.string().trim().max(5000).nullable().optional(),
  turnaroundMinutes: z.number().int().min(1).max(525_600).nullable().optional(),
  displayOrder: z.number().int().min(0).max(1_000_000).optional(),
  pricingUnit: servicePricingUnitSchema,
  labelRule: serviceLabelRuleSchema,
  status: serviceStatusSchema.optional(),
});

export const createServiceBodySchema = serviceProfileBodySchema
  .extend({
    standardPrice: standardPriceSchema,
    compareAtPrice: optionalPriceSchema,
    costPrice: optionalPriceSchema,
  })
  .superRefine((value, context) => {
    if (
      value.compareAtPrice != null &&
      Number(value.compareAtPrice) <= Number(value.standardPrice)
    ) {
      context.addIssue({
        code: "custom",
        message: "Compare-at price must be greater than the standard price.",
        path: ["compareAtPrice"],
      });
    }
  });

export const updateServiceBodySchema = serviceProfileBodySchema
  .partial()
  .extend({
    standardPrice: standardPriceSchema.optional(),
    compareAtPrice: optionalPriceSchema,
    costPrice: optionalPriceSchema,
    version: z.number().int().positive(),
  })
  .refine(
    (value) => Object.keys(value).some((key) => key !== "version"),
    "At least one service field must be provided.",
  )
  .superRefine((value, context) => {
    if (
      value.compareAtPrice != null &&
      value.standardPrice != null &&
      Number(value.compareAtPrice) <= Number(value.standardPrice)
    ) {
      context.addIssue({
        code: "custom",
        message: "Compare-at price must be greater than the standard price.",
        path: ["compareAtPrice"],
      });
    }
  });

export const updateServiceStatusBodySchema = z.object({
  status: serviceStatusSchema,
  version: z.number().int().positive(),
});
