import { z } from "zod";

export const saasUserLanguageSchema = z.enum(["en", "fr", "zh-CN"]);

export const listSaasUsersQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  status: z.enum(["invited", "active", "disabled", "suspended"]).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const getSaasUserParamsSchema = z.object({
  userId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),
});

export const createSaasUserBodySchema = z.object({
  email: z.string().trim().email().max(320),
  phone: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z
      .string()
      .trim()
      .min(3)
      .max(32)
      .regex(/^\+?[0-9][0-9\s().-]*$/)
      .optional(),
  ),
  displayName: z.string().trim().min(1).max(120),
  password: z.string().min(6).max(128),
  roleCode: z.enum(["super_admin", "support"]),
  language: saasUserLanguageSchema.default("en"),
});
