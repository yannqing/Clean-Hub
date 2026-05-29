import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const reportSummaryQuerySchema = z
  .object({
    from: z.string().regex(DATE_PATTERN).optional(),
    to: z.string().regex(DATE_PATTERN).optional(),
    branchId: z.string().regex(ULID_PATTERN).optional(),
  })
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
  );
