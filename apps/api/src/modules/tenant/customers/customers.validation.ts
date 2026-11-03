import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const ulidSchema = z.string().regex(ULID_PATTERN);

const isoTimestampSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => !Number.isNaN(Date.parse(value)),
    "Invalid ISO timestamp.",
  );

const validDateRange = (value: {
  createdAfter?: string;
  createdBefore?: string;
}) =>
  !value.createdAfter ||
  !value.createdBefore ||
  Date.parse(value.createdAfter) < Date.parse(value.createdBefore);

export const tenantCustomerOverviewQuerySchema = z
  .object({
    branchId: ulidSchema.optional(),
    createdAfter: isoTimestampSchema.optional(),
    createdBefore: isoTimestampSchema.optional(),
  })
  .refine(validDateRange, {
    message: "createdAfter must be earlier than createdBefore.",
    path: ["createdBefore"],
  });

export const tenantCustomerListQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(200).optional(),
    status: z.enum(["active", "disabled"]).optional(),
    branchId: ulidSchema.optional(),
    createdAfter: isoTimestampSchema.optional(),
    createdBefore: isoTimestampSchema.optional(),
    sort: z
      .enum(["created_desc", "created_asc", "name_asc", "name_desc"])
      .default("created_desc"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .refine(validDateRange, {
    message: "createdAfter must be earlier than createdBefore.",
    path: ["createdBefore"],
  });

export const tenantCustomerAccountListQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["active", "disabled"]).optional(),
  sort: z
    .enum(["created_desc", "created_asc", "name_asc", "name_desc"])
    .default("created_desc"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const tenantCustomerAccountCustomersQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["active", "disabled"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const tenantCustomerParamsSchema = z.object({
  customerId: ulidSchema,
});

const nullableTrimmedString = (max: number) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .transform((value) => (value === "" ? null : value))
    .optional();

export const updateTenantCustomerBodySchema = z
  .object({
    fullName: z.string().trim().min(1).max(200).optional(),
    phone: nullableTrimmedString(32),
    email: z
      .union([z.string().trim().email().max(320), z.literal(""), z.null()])
      .transform((value) => (value === "" ? null : value))
      .optional(),
    relationship: nullableTrimmedString(80),
    address: nullableTrimmedString(1000),
    notes: nullableTrimmedString(2000),
    status: z.enum(["active", "disabled"]).optional(),
    version: z.number().int().min(1),
  })
  .refine(
    (data) =>
      data.fullName !== undefined ||
      data.phone !== undefined ||
      data.email !== undefined ||
      data.relationship !== undefined ||
      data.address !== undefined ||
      data.notes !== undefined ||
      data.status !== undefined,
    "At least one customer field must be provided.",
  );

export const tenantCustomerAccountParamsSchema = z.object({
  accountId: ulidSchema,
});

export const updateTenantCustomerAccountBodySchema = z
  .object({
    accountName: z.string().trim().min(1).max(200).optional(),
    phone: z.string().trim().min(1).max(32).nullable().optional(),
    email: z.string().trim().email().max(320).nullable().optional(),
    status: z.enum(["active", "disabled"]).optional(),
    version: z.number().int().min(1),
  })
  .refine(
    (data) =>
      data.accountName !== undefined ||
      data.phone !== undefined ||
      data.email !== undefined ||
      data.status !== undefined,
    "At least one account field must be provided.",
  );

export const tenantCustomerCommentParamsSchema =
  tenantCustomerParamsSchema.extend({
    commentId: ulidSchema,
  });

export const tenantCustomerTimelineQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const createTenantCustomerCommentBodySchema = z.object({
  body: z.string().trim().min(1).max(2000),
  idempotencyKey: z.string().trim().min(1).max(120),
  mentionedUserIds: z.array(ulidSchema).max(20).default([]),
  attachments: z
    .array(
      z.object({
        objectKey: z.string().trim().min(1).max(1024),
        fileName: z.string().trim().min(1).max(255),
      }),
    )
    .max(5)
    .default([]),
});

export const updateTenantCustomerCommentBodySchema = z.object({
  body: z.string().trim().min(1).max(2000),
  version: z.number().int().min(1),
  mentionedUserIds: z.array(ulidSchema).max(20).default([]),
});

export const deleteTenantCustomerCommentBodySchema = z.object({
  version: z.number().int().min(1),
});

export const tenantCustomerAttachmentUploadBodySchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024),
});
