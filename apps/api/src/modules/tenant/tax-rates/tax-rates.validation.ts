import { z } from "zod";

import { taxRateFractionSchema } from "../../tax/tax.validation.js";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export const taxRateParamsSchema = z.object({
  taxRateId: z.string().regex(ULID_PATTERN),
});

export const taxRateListQuerySchema = z.object({
  includeArchived: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export const createTaxRateBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  rate: taxRateFractionSchema,
  displayOrder: z.number().int().min(0).max(10_000).optional(),
});

export const updateTaxRateBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    rate: taxRateFractionSchema.optional(),
    displayOrder: z.number().int().min(0).max(10_000).optional(),
    archived: z.boolean().optional(),
    // Optimistic concurrency: two owners editing the same rate must not
    // silently overwrite each other on a value that prices every sale.
    expectedVersion: z.number().int().positive(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.rate !== undefined ||
      value.displayOrder !== undefined ||
      value.archived !== undefined,
    { message: "At least one field must be provided." },
  );
