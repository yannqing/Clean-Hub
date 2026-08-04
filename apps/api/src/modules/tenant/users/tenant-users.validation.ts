import { PIN_DIGIT_PATTERN } from "@cleanhub/domain/pin";
import { z } from "zod";

const ulidSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
const managedRoleCodeSchema = z.enum(["manager", "cashier"]);
const languageSchema = z.enum(["en", "fr", "zh-CN"]);
const phoneSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^\+?[0-9][0-9\s().-]*$/);

export const listTenantUsersQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["invited", "active", "disabled", "suspended"]).optional(),
  roleCode: z.enum(["owner", "manager", "cashier"]).optional(),
  branchId: ulidSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const getTenantUserParamsSchema = z.object({ userId: ulidSchema });

export const createTenantUserBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(120),
    email: z.preprocess(
      (value) =>
        typeof value === "string" && !value.trim() ? undefined : value,
      z.string().trim().email().max(320).optional(),
    ),
    phone: z.preprocess(
      (value) =>
        typeof value === "string" && !value.trim() ? undefined : value,
      phoneSchema.optional(),
    ),
    roleCode: managedRoleCodeSchema,
    branchId: ulidSchema,
    password: z.preprocess(
      (value) =>
        typeof value === "string" && !value ? undefined : value,
      z.string().min(1).max(128).optional(),
    ),
    pin: z.string().regex(PIN_DIGIT_PATTERN, "PIN must be exactly 6 digits."),
    language: languageSchema.default("en"),
  })
  .superRefine((data, context) => {
    if (data.roleCode === "manager" && !data.email) {
      context.addIssue({
        code: "custom",
        path: ["email"],
        message: "Manager email is required.",
      });
    }

    if (data.roleCode === "manager" && !data.password) {
      context.addIssue({
        code: "custom",
        path: ["password"],
        message: "Manager password is required.",
      });
    }
  });

export const updateTenantUserBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().max(320).optional(),
    phone: z.preprocess(
      (value) =>
        typeof value === "string" && !value.trim() ? null : value,
      phoneSchema.nullable().optional(),
    ),
    roleCode: managedRoleCodeSchema.optional(),
    branchId: ulidSchema.optional(),
    password: z.string().min(1).max(128).optional(),
    language: languageSchema.optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
  })
  .strict()
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    "At least one field must be provided.",
  );

export const updateTenantUserStatusBodySchema = z.object({
  status: z.enum(["active", "disabled"]),
  reason: z.string().trim().min(1).max(500),
});

export const resetTenantUserPinBodySchema = z.object({
  pin: z.string().regex(PIN_DIGIT_PATTERN, "PIN must be exactly 6 digits."),
  reason: z.string().trim().min(1).max(500),
});

export const resetTenantUserPasswordBodySchema = z.object({
  password: z.string().min(1).max(128),
  reason: z.string().trim().min(1).max(500),
});
