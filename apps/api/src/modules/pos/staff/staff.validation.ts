import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const ulidSchema = z.string().regex(ULID_PATTERN);
const moneySchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/)
  .refine((value) => Number(value) >= 0);
const positiveMoneySchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/)
  .refine((value) => Number(value) > 0);

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
  })
  .strict();

export const openRegisterRequestSchema = z
  .object({
    openingFloat: moneySchema.optional(),
  })
  .strict();

export const closeRegisterRequestSchema = z
  .object({
    countedCash: moneySchema.optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

export const createHandoverRequestSchema = z.object({
  incomingStaffId: ulidSchema,
  countedCash: moneySchema,
  notes: z.string().trim().max(2000).optional(),
});

export const createShiftCashMovementRequestSchema = z.object({
  movementType: z.enum(["pay_in", "pay_out"]),
  amount: positiveMoneySchema,
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: z.string().trim().min(1).max(120),
});

export const posZReportListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
