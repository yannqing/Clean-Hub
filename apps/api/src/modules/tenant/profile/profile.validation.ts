import { z } from "zod";
import { PIN_DIGIT_PATTERN } from "@cleanhub/domain/pin";

export const tenantProfileLanguageSchema = z.enum(["en", "fr", "zh-CN"]);

export const updateTenantProfileBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().max(320).optional(),
    phone: z.string().trim().max(32).nullable().optional(),
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

export const changeTenantProfilePinBodySchema = z.object({
  currentPin: z.string().regex(PIN_DIGIT_PATTERN),
  newPin: z.string().regex(PIN_DIGIT_PATTERN),
}).strict();

export const tenantLoginSessionParamsSchema = z.object({
  sessionId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),
});
