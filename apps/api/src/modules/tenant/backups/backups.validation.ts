import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export const backupJobListQuerySchema = z.object({
  status: z.enum(["pending", "running", "succeeded", "failed"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createBackupJobBodySchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const backupJobParamsSchema = z.object({
  backupId: z.string().regex(ULID_PATTERN),
});

export const createRestoreRequestBodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
});
