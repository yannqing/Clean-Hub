import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const posPaymentMethodSchema = z.enum(["cash", "card", "app"]);
const posRoundingRuleSchema = z.enum(["none", "round_yuan", "round_jiao"]);

export const createTerminalSettingsBodySchema = z.object({
  branchId: z.string().regex(ULID_PATTERN),
  deviceId: z.string().trim().min(1).max(128),
  label: z.string().trim().max(64).optional(),
  defaultPaymentMethod: posPaymentMethodSchema.optional(),
  paymentMethodsEnabled: z.array(posPaymentMethodSchema).min(1).max(3).optional(),
  roundingRule: posRoundingRuleSchema.optional(),
  autoPrintReceipt: z.boolean().optional(),
  printCopies: z.coerce.number().int().min(1).max(10).optional(),
  lockTimeoutSeconds: z.coerce.number().int().min(30).max(86400).optional(),
});

export const updateTerminalSettingsBodySchema = z
  .object({
    label: z.string().trim().max(64).optional(),
    defaultPaymentMethod: posPaymentMethodSchema.optional(),
    paymentMethodsEnabled: z.array(posPaymentMethodSchema).min(1).max(3).optional(),
    roundingRule: posRoundingRuleSchema.optional(),
    autoPrintReceipt: z.boolean().optional(),
    printCopies: z.coerce.number().int().min(1).max(10).optional(),
    lockTimeoutSeconds: z.coerce.number().int().min(30).max(86400).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one setting field must be provided.",
  );

const nullableTrimmedString = (max: number) =>
  z.union([z.string().trim().max(max), z.null()]);

export const terminalHeartbeatBodySchema = z
  .object({
    deviceType: z
      .enum(["unknown", "desktop", "tablet", "phone", "browser"])
      .optional(),
    platform: nullableTrimmedString(64).optional(),
    platformVersion: nullableTrimmedString(64).optional(),
    appVersion: nullableTrimmedString(64).optional(),
    syncStatus: z.enum(["never", "syncing", "synced", "error"]).optional(),
    lastSyncedAt: z
      .union([z.string().datetime({ offset: true }), z.null()])
      .optional(),
    lastSyncError: nullableTrimmedString(2000).optional(),
    pendingSalesCount: z.number().int().min(0).max(1_000_000).optional(),
    pendingOperationsCount: z.number().int().min(0).max(10_000_000).optional(),
    oldestPendingAt: z
      .union([z.string().datetime({ offset: true }), z.null()])
      .optional(),
  })
  .strict();
