import { z } from "zod";

const userStatusSchema = z.enum(["invited", "active", "disabled", "suspended"]);
const userTypeSchema = z.enum(["saas", "tenant"]);

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const saasUserListQuerySchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  status: z.preprocess(emptyToUndefined, userStatusSchema.optional()),
  limit: z.coerce.number().int().positive().max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export const saasUserIdParamSchema = z.object({
  userId: z.string().trim().min(1),
});

export const createSaasUserSchema = z
  .object({
    tenantId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
    userType: userTypeSchema.default("saas"),
    email: z.preprocess(
      emptyToUndefined,
      z.string().trim().email().max(320).optional(),
    ),
    phone: z.preprocess(
      emptyToUndefined,
      z.string().trim().max(32).optional(),
    ),
    displayName: z.string().trim().min(1).max(120),
    password: z.string().min(6),
    status: userStatusSchema.default("active"),
  })
  .refine((input) => input.email || input.phone, {
    message: "Email or phone is required.",
    path: ["email"],
  });

export const updateSaasUserSchema = z
  .object({
    tenantId: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? null : value,
      z.string().trim().min(1).nullable().optional(),
    ),
    userType: userTypeSchema.optional(),
    email: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? null : value,
      z.string().trim().email().max(320).nullable().optional(),
    ),
    phone: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? null : value,
      z.string().trim().max(32).nullable().optional(),
    ),
    displayName: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).max(120).optional(),
    ),
    password: z.preprocess(emptyToUndefined, z.string().min(6).optional()),
    status: userStatusSchema.optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one field is required.",
  });

export type SaasUserListQuery = z.infer<typeof saasUserListQuerySchema>;
export type CreateSaasUserBody = z.infer<typeof createSaasUserSchema>;
export type UpdateSaasUserBody = z.infer<typeof updateSaasUserSchema>;
