import { z } from "zod";

export const saasTenantStatusSchema = z.enum([
  "active",
  "suspended",
  "disabled",
]);
export const saasTenantLanguageSchema = z.enum(["en", "fr", "zh-CN"]);

const optionalStringSchema = (max: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === ""
        ? undefined
        : value,
    z.string().trim().max(max).optional(),
  );

const nullableStringSchema = (max: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? null : value,
    z.string().trim().max(max).nullable().optional(),
  );

const currencyCodeSchema = z.preprocess(
  (value) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  z.string().regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code."),
);

export const listSaasTenantsQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  status: saasTenantStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const getSaasTenantParamsSchema = z.object({
  tenantId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),
});

export const createSaasTenantBodySchema = z.object({
  name: z.string().trim().min(1).max(160),
  pressingCode: z.string().trim().min(1).max(80),
  country: z.string().trim().min(1).max(80),
  city: optionalStringSchema(120),
  defaultLanguage: saasTenantLanguageSchema.optional(),
  defaultCurrency: currencyCodeSchema.default("XOF"),
  contactName: optionalStringSchema(120),
  contactPhone: optionalStringSchema(32),
  contactEmail: z
    .preprocess(
      (value) =>
        typeof value === "string" && value.trim() === ""
          ? undefined
          : value,
      z.string().trim().email().max(320).optional(),
    ),
  status: saasTenantStatusSchema.default("active"),
});

export const updateSaasTenantBodySchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    pressingCode: z.string().trim().min(1).max(80).optional(),
    country: z.string().trim().min(1).max(80).optional(),
    city: nullableStringSchema(120),
    contactName: nullableStringSchema(120),
    contactPhone: nullableStringSchema(32),
    contactEmail: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? null : value,
      z.string().trim().email().max(320).nullable().optional(),
    ),
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    "At least one tenant field must be provided.",
  );

export const updateSaasTenantStatusBodySchema = z.object({
  status: saasTenantStatusSchema,
  reason: z.string().trim().min(1).max(500),
});

export const updateSaasTenantSettingsBodySchema = z
  .object({
    defaultLanguage: saasTenantLanguageSchema.optional(),
    defaultCurrency: currencyCodeSchema.optional(),
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    "At least one tenant setting must be provided.",
  );

export const updateSaasTenantFeatureFlagsBodySchema = z
  .object({
    laundryEnabled: z.boolean().optional(),
    carWashEnabled: z.boolean().optional(),
    retailProductsEnabled: z.boolean().optional(),
    deliveryEnabled: z.boolean().optional(),
    notificationsEnabled: z.boolean().optional(),
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    "At least one tenant feature flag must be provided.",
  );
