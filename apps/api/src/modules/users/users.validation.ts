import { z } from "zod";

const ulidSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);

export const listTenantUsersQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  status: z.enum(["invited", "active", "disabled", "suspended"]).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const getTenantUserParamsSchema = z.object({
  userId: ulidSchema,
});

export const createTenantUserBodySchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  email: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.string().trim().email().max(320).optional(),
  ),
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
  roleCode: z.enum(["owner", "manager"]),
  branchIds: z.preprocess(
    (value) => (Array.isArray(value) ? [...new Set(value)] : value),
    z.array(ulidSchema).optional(),
  ),
  initialPin: z.string().regex(/^\d{6}$/, "PIN must be exactly 6 digits."),
});

export const updateTenantUserBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    phone: z.preprocess(
      (value) =>
        typeof value === "string" && !value.trim() ? null : value,
      z
        .string()
        .trim()
        .min(3)
        .max(32)
        .regex(/^\+?[0-9][0-9\s().-]*$/)
        .nullable()
        .optional(),
    ),
    branchIds: z.preprocess(
      (value) => (Array.isArray(value) ? [...new Set(value)] : value),
      z.array(ulidSchema).optional(),
    ),
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    "At least one field must be provided.",
  );
