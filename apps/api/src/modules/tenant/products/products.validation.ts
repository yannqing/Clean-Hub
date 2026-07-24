import { z } from "zod";

const isoTimestampSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => !Number.isNaN(Date.parse(value)),
    "Invalid ISO timestamp.",
  );

export const tenantProductStatusSchema = z.enum(["active", "inactive"]);

export const tenantProductListQuerySchema = z
  .object({
    status: tenantProductStatusSchema.optional(),
    createdAfter: isoTimestampSchema.optional(),
    createdBefore: isoTimestampSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .refine(
    (value) =>
      !value.createdAfter ||
      !value.createdBefore ||
      new Date(value.createdAfter).getTime() <
        new Date(value.createdBefore).getTime(),
    {
      message: "createdAfter must be before createdBefore.",
      path: ["createdAfter"],
    },
  );

export const tenantProductOverviewQuerySchema = z
  .object({
    createdAfter: isoTimestampSchema.optional(),
    createdBefore: isoTimestampSchema.optional(),
  })
  .refine(
    (value) =>
      !value.createdAfter ||
      !value.createdBefore ||
      new Date(value.createdAfter).getTime() <
        new Date(value.createdBefore).getTime(),
    {
      message: "createdAfter must be before createdBefore.",
      path: ["createdAfter"],
    },
  );
