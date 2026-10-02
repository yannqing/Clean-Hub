import { z } from "zod";

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const updatePlatformSettingsBodySchema = z
  .object({
    defaultLanguage: z.enum(["en", "fr", "zh-CN"]).optional(),
    defaultCurrency: z.string().trim().min(1).max(3).optional(),
    timezone: z.string().trim().min(1).max(64)
      .refine(isValidTimezone, "Timezone must be a valid IANA timezone.")
      .optional(),
    maintenanceMode: z.boolean().optional(),
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    "At least one platform setting field must be provided.",
  );
