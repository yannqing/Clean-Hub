import { z } from "zod";

export const updatePlatformSettingsBodySchema = z
  .object({
    defaultLanguage: z.enum(["en", "fr", "zh-CN"]).optional(),
    defaultCurrency: z.string().trim().min(1).max(3).optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
    maintenanceMode: z.boolean().optional(),
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    "At least one platform setting field must be provided.",
  );
