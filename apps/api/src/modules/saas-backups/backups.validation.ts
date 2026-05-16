import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export const backupJobListQuerySchema = z.object({
  scope: z.enum(["platform", "tenant"]).optional(),
  status: z.enum(["pending", "running", "succeeded", "failed"]).optional(),
  tenantId: z.string().regex(ULID_PATTERN).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
