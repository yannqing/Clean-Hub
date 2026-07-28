import { z } from "zod";

export const tenantProfileLanguageSchema = z.enum(["en", "fr", "zh-CN"]);

export const updateTenantProfileBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    language: tenantProfileLanguageSchema.optional(),
  })
  .strict()
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    "At least one profile field must be provided.",
  );

export const changeTenantProfilePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(1).max(128),
  })
  .strict();
