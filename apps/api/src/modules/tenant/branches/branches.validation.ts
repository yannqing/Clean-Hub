import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export const branchStatusSchema = z.enum(["active", "inactive"]);
export const branchLanguageSchema = z.enum(["en", "fr", "zh-CN"]);

const nullableStringSchema = (max: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? null : value,
    z.string().trim().max(max).nullable().optional(),
  );

const currencyCodeSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.string().regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code."),
);

const businessHoursSchema = z.record(z.string(), z.unknown()).nullable();
const versionSchema = z.coerce.number().int().min(1);

export const branchListQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  status: branchStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const branchParamsSchema = z.object({
  branchId: z.string().regex(ULID_PATTERN),
});

export const createBranchBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: nullableStringSchema(500),
  phone: nullableStringSchema(32),
  businessHours: businessHoursSchema.optional(),
  defaultLanguage: branchLanguageSchema.default("en"),
  defaultCurrency: currencyCodeSchema.default("XOF"),
  receiptName: nullableStringSchema(200),
  receiptPhone: nullableStringSchema(32),
  receiptAddress: nullableStringSchema(500),
  logoUrl: nullableStringSchema(2048),
  status: branchStatusSchema.default("active"),
});

export const updateBranchBodySchema = createBranchBodySchema
  .omit({ status: true })
  .partial()
  .extend({
    version: versionSchema,
  })
  .strict()
  .refine(
    (data) =>
      Object.entries(data).some(
        ([key, value]) => key !== "version" && value !== undefined,
      ),
    "At least one branch field must be provided.",
  );

export const updateBranchStatusBodySchema = z.object({
  status: branchStatusSchema,
  version: versionSchema,
});
