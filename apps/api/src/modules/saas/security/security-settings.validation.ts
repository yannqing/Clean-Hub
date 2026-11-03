import { z } from "zod";

export const updateSecuritySettingsBodySchema = z
  .object({
    passwordMinLength: z.number().int().min(6).max(128).optional(),
    passwordRequiresNumber: z.boolean().optional(),
    passwordRequiresSymbol: z.boolean().optional(),
    loginMaxAttempts: z.number().int().min(1).max(20).optional(),
    lockoutMinutes: z.number().int().min(1).max(1440).optional(),
    refreshTokenDays: z.number().int().min(1).max(365).optional(),
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    "At least one security setting field must be provided.",
  );
