import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const isoTimestampSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => !Number.isNaN(Date.parse(value)),
    "Invalid ISO timestamp.",
  );

export const tenantCustomerListQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(200).optional(),
    status: z.enum(["active", "disabled"]).optional(),
    branchId: z.string().regex(ULID_PATTERN).optional(),
    createdAfter: isoTimestampSchema.optional(),
    createdBefore: isoTimestampSchema.optional(),
    sort: z
      .enum(["created_desc", "created_asc", "name_asc", "name_desc"])
      .default("created_desc"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .refine(
    (value) =>
      !value.createdAfter ||
      !value.createdBefore ||
      Date.parse(value.createdAfter) < Date.parse(value.createdBefore),
    {
      message: "createdAfter must be earlier than createdBefore.",
      path: ["createdBefore"],
    },
  );
