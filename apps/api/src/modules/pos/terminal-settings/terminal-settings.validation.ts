import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const posPaymentMethodSchema = z.enum(["cash", "card", "app"]);
const posRoundingRuleSchema = z.enum(["none", "round_yuan", "round_jiao"]);

export const createTerminalSettingsBodySchema = z.object({
  branchId: z.string().regex(ULID_PATTERN),
  deviceId: z.string().trim().min(1).max(128),
  label: z.string().trim().max(64).optional(),
  defaultPaymentMethod: posPaymentMethodSchema.default("cash"),
  roundingRule: posRoundingRuleSchema.default("none"),
  autoPrintReceipt: z.boolean().default(true),
  printCopies: z.coerce.number().int().min(1).max(10).default(1),
  lockTimeoutSeconds: z.coerce.number().int().min(30).max(3600).default(300),
});

export const updateTerminalSettingsBodySchema = z
  .object({
    label: z.string().trim().max(64).optional(),
    defaultPaymentMethod: posPaymentMethodSchema.optional(),
    roundingRule: posRoundingRuleSchema.optional(),
    autoPrintReceipt: z.boolean().optional(),
    printCopies: z.coerce.number().int().min(1).max(10).optional(),
    lockTimeoutSeconds: z.coerce.number().int().min(30).max(3600).optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one setting field must be provided.",
  );
