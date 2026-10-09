import { z } from "zod";
import { isSupportedTimeZone } from "@cleanhub/domain/timezone";

export const tenantSettingsLanguageSchema = z.enum(["en", "fr", "zh-CN"]);

const currencyCodeSchema = z.preprocess(
  (value) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  z.string().regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code."),
);

const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(isSupportedTimeZone, "Timezone must be a valid IANA timezone.");

const nullableStringSchema = (max: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? null : value,
    z.string().trim().max(max).nullable().optional(),
  );

export const updateTenantSettingsBodySchema = z
  .object({
    tenantName: z.string().trim().min(1).max(160).optional(),
    country: nullableStringSchema(80),
    city: nullableStringSchema(120),
    contactName: nullableStringSchema(120),
    contactPhone: nullableStringSchema(32),
    contactEmail: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? null : value,
      z.string().trim().email().max(320).nullable().optional(),
    ),
    tenantVersion: z.coerce.number().int().min(1).optional(),
    defaultLanguage: tenantSettingsLanguageSchema.optional(),
    defaultCurrency: currencyCodeSchema.optional(),
    timezone: timezoneSchema.optional(),
  })
  .strict()
  .superRefine((data, context) => {
    const hasProfileField = [
      data.tenantName,
      data.country,
      data.city,
      data.contactName,
      data.contactPhone,
      data.contactEmail,
    ].some((value) => value !== undefined);

    if (hasProfileField && data.tenantVersion === undefined) {
      context.addIssue({
        code: "custom",
        message: "tenantVersion is required when updating tenant details.",
        path: ["tenantVersion"],
      });
    }
    if (!hasProfileField && data.tenantVersion !== undefined) {
      context.addIssue({
        code: "custom",
        message: "tenantVersion cannot be updated by itself.",
        path: ["tenantVersion"],
      });
    }
  })
  .refine(
    (data) =>
      Object.entries(data).some(
        ([key, value]) => key !== "tenantVersion" && value !== undefined,
      ),
    "At least one tenant setting must be provided.",
  );
