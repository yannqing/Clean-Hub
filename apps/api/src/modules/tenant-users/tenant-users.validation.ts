import { z } from "zod";

const ulidSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);

const roleCodeSchema = z.enum(["owner", "manager", "cashier"]);

export const listTenantUsersQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(["invited", "active", "disabled", "suspended"]).optional(),
  role: z.enum(["owner", "manager", "cashier"]).optional(),
  branchId: ulidSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const getTenantUserParamsSchema = z.object({
  userId: ulidSchema,
});

export const createTenantUserBodySchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  email: z.preprocess(
    (v) => (typeof v === "string" && !v.trim() ? undefined : v),
    z.string().trim().email().max(320).optional(),
  ),
  phone: z.preprocess(
    (v) => (typeof v === "string" && !v.trim() ? undefined : v),
    z.string().trim().min(3).max(32).optional(),
  ),
  roleCode: roleCodeSchema,
  branchIds: z.preprocess(
    (v) => (Array.isArray(v) ? [...new Set(v)] : v),
    z.array(ulidSchema).optional(),
  ),
  initialPin: z.string().regex(/^\d{6}$/, "PIN must be exactly 6 digits."),
});

export const updateTenantUserBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    phone: z.preprocess(
      (v) => (typeof v === "string" && !v.trim() ? null : v),
      z.string().trim().min(3).max(32).nullable().optional(),
    ),
    branchIds: z.preprocess(
      (v) => (Array.isArray(v) ? [...new Set(v)] : v),
      z.array(ulidSchema).optional(),
    ),
    roleCode: roleCodeSchema.optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    "At least one field must be provided.",
  );

export const resetTenantUserPinBodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
});
