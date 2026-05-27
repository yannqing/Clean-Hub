import { z } from "zod";

export const tenantSettingsLanguageSchema = z.enum(["en", "fr", "zh-CN"]);

const currencyCodeSchema = z.preprocess(
  (value) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  z.string().regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code."),
);

export const updateTenantSettingsBodySchema = z
  .object({
    defaultLanguage: tenantSettingsLanguageSchema.optional(),
    defaultCurrency: currencyCodeSchema.optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    "At least one tenant setting must be provided.",
  );
