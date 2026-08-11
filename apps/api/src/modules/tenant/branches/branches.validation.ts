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

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const businessDayHoursSchema = z
  .object({
    opensAt: timeSchema,
    closesAt: timeSchema,
  })
  .strict()
  .refine((value) => value.opensAt < value.closesAt, {
    message: "Closing time must be later than opening time.",
    path: ["closesAt"],
  });
const businessHoursSchema = z
  .object({
    monday: businessDayHoursSchema.optional(),
    tuesday: businessDayHoursSchema.optional(),
    wednesday: businessDayHoursSchema.optional(),
    thursday: businessDayHoursSchema.optional(),
    friday: businessDayHoursSchema.optional(),
    saturday: businessDayHoursSchema.optional(),
    sunday: businessDayHoursSchema.optional(),
  })
  .strict()
  .nullable();
const branchLogoObjectKeySchema = z
  .string()
  .trim()
  .regex(
    /^tenant\/[0-9A-HJKMNP-TV-Z]{26}\/branch_logo\/unassigned\/[A-Za-z0-9._-]+$/,
  )
  .max(1024)
  .nullable();
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
  receiptName: nullableStringSchema(200),
  receiptPhone: nullableStringSchema(32),
  receiptAddress: nullableStringSchema(500),
  logoObjectKey: branchLogoObjectKeySchema.optional(),
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

export const requestBranchLogoUploadBodySchema = z
  .object({
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(5 * 1_024 * 1_024),
  })
  .strict();
