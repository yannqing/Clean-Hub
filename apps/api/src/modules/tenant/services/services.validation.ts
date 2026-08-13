import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const serviceMediaObjectKeysSchema = z
  .array(z.string().trim().min(1).max(1_024))
  .max(10)
  .refine((keys) => new Set(keys).size === keys.length, {
    message: "Service images must be unique.",
  });
const retainedServiceMediaIdsSchema = z
  .array(z.string().regex(ULID_PATTERN))
  .max(10)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "Retained service images must be unique.",
  });

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
const serviceBranchSettingSchema = z.object({
  branchId: z.string().regex(ULID_PATTERN),
  isAvailable: z.boolean(),
  priceOverrideAmount: optionalPriceSchema,
  turnaroundMinutesOverride: z
    .number()
    .int()
    .min(1)
    .max(525_600)
    .nullable()
    .optional(),
});

function validateBranchSettings(
  value: {
    allBranches?: boolean;
    branchSettings?: Array<{ branchId: string; isAvailable: boolean }>;
  },
  context: z.RefinementCtx,
) {
  const settings = value.branchSettings ?? [];
  const uniqueBranchIds = new Set(settings.map((setting) => setting.branchId));
  if (uniqueBranchIds.size !== settings.length) {
    context.addIssue({
      code: "custom",
      message: "A branch can only be configured once.",
      path: ["branchSettings"],
    });
  }
  if (
    value.allBranches === false &&
    settings.every((setting) => !setting.isAvailable)
  ) {
    context.addIssue({
      code: "custom",
      message: "Select at least one available branch.",
      path: ["branchSettings"],
    });
  }
}
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
  allBranches: z.boolean().optional(),
  branchSettings: z.array(serviceBranchSettingSchema).max(100).optional(),
  displayOrder: z.number().int().min(0).max(1_000_000).optional(),
  pricingUnit: servicePricingUnitSchema,
  labelRule: serviceLabelRuleSchema,
  status: serviceStatusSchema.optional(),
  mediaObjectKeys: serviceMediaObjectKeysSchema.optional(),
});

export const createServiceBodySchema = serviceProfileBodySchema
  .extend({
    standardPrice: standardPriceSchema,
    compareAtPrice: optionalPriceSchema,
    costPrice: optionalPriceSchema,
  })
  .superRefine((value, context) => {
    validateBranchSettings(value, context);
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
  .omit({ mediaObjectKeys: true })
  .partial()
  .extend({
    standardPrice: standardPriceSchema.optional(),
    compareAtPrice: optionalPriceSchema,
    costPrice: optionalPriceSchema,
    version: z.number().int().positive(),
    retainedMediaIds: retainedServiceMediaIdsSchema.optional(),
    newMediaObjectKeys: serviceMediaObjectKeysSchema.optional(),
  })
  .refine(
    (value) => Object.keys(value).some((key) => key !== "version"),
    "At least one service field must be provided.",
  )
  .superRefine((value, context) => {
    validateBranchSettings(value, context);
    if (
      (value.retainedMediaIds?.length ?? 0) +
        (value.newMediaObjectKeys?.length ?? 0) >
      10
    ) {
      context.addIssue({
        code: "custom",
        message: "A service can have at most 10 images.",
        path: ["newMediaObjectKeys"],
      });
    }
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

export const requestTenantServiceMediaUploadBodySchema = z
  .object({
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(5 * 1_024 * 1_024),
  })
  .strict();

export const updateServiceStatusBodySchema = z.object({
  status: serviceStatusSchema,
  version: z.number().int().positive(),
});
