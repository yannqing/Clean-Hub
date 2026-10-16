import { z } from "zod";

export const saasUserLanguageSchema = z.enum(["en", "fr", "zh-CN"]);

export const listSaasUsersQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  status: z.enum(["invited", "active", "disabled", "suspended"]).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const listSaasUserDirectoryQuerySchema = listSaasUsersQuerySchema.extend({
  accountType: z.enum(["saas", "tenant"]).optional(),
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
  password: z.string().min(1).max(128),
  roleCode: z.enum(["super_admin", "support"]),
  language: saasUserLanguageSchema.default("en"),
});

const optionalPhoneSchema = z.preprocess(
  (value) => (typeof value === "string" && !value.trim() ? null : value),
  z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^\+?[0-9][0-9\s().-]*$/)
    .nullable()
    .optional(),
);

export const updateSaasUserBodySchema = z
  .object({
    email: z.string().trim().email().max(320).optional(),
    phone: optionalPhoneSchema,
    displayName: z.string().trim().min(1).max(120).optional(),
    language: saasUserLanguageSchema.optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    "At least one SaaS user field must be provided.",
  );

export const updateSaasUserStatusBodySchema = z.object({
  status: z.enum(["active", "disabled"]),
  reason: z
    .preprocess(
      (value) =>
        typeof value === "string" && !value.trim() ? undefined : value,
      z.string().trim().max(300).optional(),
    ),
});

export const updateSaasUserRolesBodySchema = z.object({
  roleCodes: z.preprocess(
    (value) => (Array.isArray(value) ? [...new Set(value)] : value),
    z.array(z.enum(["super_admin", "support"])).min(1).max(2),
  ),
});

export const resetSaasUserPasswordBodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
});
