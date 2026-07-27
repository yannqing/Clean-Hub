import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

const dateOnlySchema = z
  .string()
  .regex(DATE_PATTERN)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);

    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, "Date must be a valid calendar date.");

export const financeSummaryQuerySchema = z
  .object({
    from: dateOnlySchema.optional(),
    to: dateOnlySchema.optional(),
    branchId: z.string().regex(ULID_PATTERN).optional(),
    currency: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .pipe(z.string().regex(CURRENCY_PATTERN))
      .optional(),
  })
  .refine(
    (value) =>
      (value.from === undefined && value.to === undefined) ||
      (value.from !== undefined && value.to !== undefined),
    {
      message: "from and to must be provided together.",
      path: ["from"],
    },
  )
  .refine(
    (value) => {
      if (!value.from || !value.to) {
        return true;
      }

      return value.from <= value.to;
    },
    {
      message: "from must be before or equal to to.",
      path: ["from"],
    },
  )
  .refine(
    (value) => {
      if (!value.from || !value.to) {
        return true;
      }

      const start = new Date(`${value.from}T00:00:00.000Z`);
      const end = new Date(`${value.to}T00:00:00.000Z`);
      const days =
        Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) +
        1;

      return days <= 366;
    },
    {
      message: "Date range must be 366 days or fewer.",
      path: ["to"],
    },
  );
