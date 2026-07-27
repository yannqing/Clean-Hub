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

const currencySchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(z.string().regex(CURRENCY_PATTERN));

function validateDateRange(
  value: { from?: string; to?: string },
  context: z.RefinementCtx,
): void {
  if ((value.from === undefined) !== (value.to === undefined)) {
    context.addIssue({
      code: "custom",
      message: "from and to must be provided together.",
      path: ["from"],
    });
    return;
  }

  if (!value.from || !value.to) {
    return;
  }

  if (value.from > value.to) {
    context.addIssue({
      code: "custom",
      message: "from must be before or equal to to.",
      path: ["from"],
    });
    return;
  }

  const start = new Date(`${value.from}T00:00:00.000Z`);
  const end = new Date(`${value.to}T00:00:00.000Z`);
  const days =
    Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  if (days > 366) {
    context.addIssue({
      code: "custom",
      message: "Date range must be 366 days or fewer.",
      path: ["to"],
    });
  }
}

const dateRangeQuerySchema = z.object({
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});

export const posChannelOverviewQuerySchema = dateRangeQuerySchema
  .extend({
    branchId: z.string().regex(ULID_PATTERN).optional(),
    currency: currencySchema.optional(),
  })
  .superRefine(validateDateRange);

export const posChannelDeviceListQuerySchema = z.object({
  branchId: z.string().regex(ULID_PATTERN).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  connectivity: z.enum(["online", "offline", "never"]).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export const posChannelRegisterSessionQuerySchema = dateRangeQuerySchema
  .extend({
    branchId: z.string().regex(ULID_PATTERN).optional(),
    status: z.enum(["open", "on_break", "closed"]).optional(),
    q: z.string().trim().min(1).max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .superRefine(validateDateRange);

export const updatePosChannelSettingsBodySchema = z
  .object({
    cashTrackingEnabled: z.boolean().optional(),
    requireOpeningFloat: z.boolean().optional(),
    requireClosingCount: z.boolean().optional(),
    requireReturnReason: z.boolean().optional(),
    recentCartRetentionHours: z.coerce
      .number()
      .int()
      .min(1)
      .max(720)
      .optional(),
    offlineModeEnabled: z.boolean().optional(),
    syncIntervalSeconds: z.coerce.number().int().min(5).max(3600).optional(),
    deviceOfflineAfterSeconds: z.coerce
      .number()
      .int()
      .min(10)
      .max(86400)
      .optional(),
    defaultPaymentMethod: z.enum(["cash", "card", "app"]).optional(),
    defaultRoundingRule: z
      .enum(["none", "round_yuan", "round_jiao"])
      .optional(),
    defaultAutoPrintReceipt: z.boolean().optional(),
    defaultPrintCopies: z.coerce.number().int().min(1).max(10).optional(),
    defaultLockTimeoutSeconds: z.coerce
      .number()
      .int()
      .min(30)
      .max(86400)
      .optional(),
    version: z.coerce.number().int().min(0),
  })
  .strict()
  .refine(
    (data) =>
      Object.entries(data).some(
        ([key, value]) => key !== "version" && value !== undefined,
      ),
    "At least one POS channel setting must be provided.",
  );
