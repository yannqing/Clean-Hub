import { z } from "zod";

/**
 * Request validation for POS customer management.
 *
 * Conventions borrowed from tenant-users.validation.ts:
 *   - ULID path params are validated with a shared regex.
 *   - Optional string inputs that are empty after trim are coerced to
 *     undefined/null so "no value" stays distinct from "invalid value".
 *   - All constraints live INSIDE the preprocessed string schema; chaining
 *     .max()/.email() on a ZodPreprocess result is not allowed.
 *   - PATCH bodies require at least one field via `.refine`.
 */
const ulidSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);

const customerStatusSchema = z.enum(["active", "disabled"]);

/** Optional string that drops empty/whitespace to undefined. */
function optionalNonEmpty(max: number) {
  return z.preprocess(
    (v) => (typeof v === "string" && !v.trim() ? undefined : v),
    z.string().trim().min(1).max(max),
  ).optional();
}

function optionalEmail(max = 320) {
  return z.preprocess(
    (v) => (typeof v === "string" && !v.trim() ? undefined : v),
    z.string().trim().email().max(max),
  ).optional();
}

/** PATCH field: empty/whitespace coerces to null so the value can be cleared. */
function nullableString(max: number) {
  return z.preprocess(
    (v) => (typeof v === "string" && !v.trim() ? null : v),
    z.string().trim().max(max),
  ).nullable().optional();
}

function nullableEmail(max = 320) {
  return z.preprocess(
    (v) => (typeof v === "string" && !v.trim() ? null : v),
    z.string().trim().email().max(max),
  ).nullable().optional();
}

export const listPosCustomersQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  resultType: z.enum(["account", "profile"]).optional(),
  status: customerStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const posAccountIdParamsSchema = z.object({
  accountId: ulidSchema,
});

export const posCustomerIdParamsSchema = z.object({
  customerId: ulidSchema,
});

export const createPosAccountBodySchema = z
  .object({
    accountName: z.string().trim().min(1).max(200),
    phone: optionalNonEmpty(32),
    email: optionalEmail(),
  })
  .refine(
    (data) => Boolean(data.phone || data.email),
    "At least one of phone or email is required.",
  );

export const createPosProfileBodySchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  phone: optionalNonEmpty(32),
  email: optionalEmail(),
  relationship: optionalNonEmpty(80),
  address: optionalNonEmpty(1000),
  notes: optionalNonEmpty(2000),
});

export const updatePosAccountBodySchema = z
  .object({
    accountName: z.string().trim().min(1).max(200).optional(),
    phone: nullableString(32),
    email: nullableEmail(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    "At least one field must be provided.",
  );

export const updatePosProfileBodySchema = z
  .object({
    fullName: z.string().trim().min(1).max(200).optional(),
    phone: nullableString(32),
    email: nullableEmail(),
    relationship: nullableString(80),
    address: nullableString(1000),
    notes: nullableString(2000),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    "At least one field must be provided.",
  );

export const changePosCustomerStatusBodySchema = z.object({
  status: customerStatusSchema,
  reason: z.string().trim().max(500).optional(),
});
