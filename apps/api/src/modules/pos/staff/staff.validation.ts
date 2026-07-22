import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const ulidSchema = z.string().regex(ULID_PATTERN);
const moneySchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/)
  .refine((value) => Number(value) >= 0);

export const posStaffListQuerySchema = z.object({
  role: z.enum(["owner", "manager", "cashier"]).optional(),
  status: z.enum(["on_duty", "off_duty", "on_break"]).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const posStaffParamsSchema = z.object({ staffId: ulidSchema });
export const posZReportParamsSchema = z.object({ zReportId: ulidSchema });

export const clockRequestSchema = z
  .object({
    action: z.enum(["clock_in", "clock_out", "break_start", "break_end"]),
    openingFloat: moneySchema.optional(),
    closingFloat: moneySchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.action === "clock_in" && value.openingFloat === undefined) {
      context.addIssue({
        code: "custom",
        path: ["openingFloat"],
        message: "Opening float is required for clock-in.",
      });
    }
    if (value.action === "clock_out" && value.closingFloat === undefined) {
      context.addIssue({
        code: "custom",
        path: ["closingFloat"],
        message: "Closing float is required for clock-out.",
      });
    }
  });

export const createHandoverRequestSchema = z.object({
  incomingStaffId: ulidSchema,
  countedCash: moneySchema,
  notes: z.string().trim().max(2000).optional(),
});

export const posZReportListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
