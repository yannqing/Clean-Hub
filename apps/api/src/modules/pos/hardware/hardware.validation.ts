import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const reasonSchema = z.string().trim().min(1).max(500);

export const authorizeManualDrawerOpenBodySchema = z.object({
  reason: reasonSchema,
});

export const authorizePrivilegedReprintBodySchema = z.object({
  reason: reasonSchema,
  documentType: z.enum(["receipt", "label"]),
  entityId: z.string().regex(ULID_PATTERN).optional(),
  originalPrintJobId: z.string().trim().min(1).max(128).optional(),
});

export const recordPosPrintJobResultBodySchema = z.object({
  jobId: z.string().regex(ULID_PATTERN),
  documentType: z.enum(["receipt", "label"]),
  entityId: z.string().regex(ULID_PATTERN),
  status: z.enum(["printed", "failed"]),
  attempt: z.number().int().positive(),
  error: z.string().trim().min(1).max(1_000).optional(),
  authorizationId: z.string().regex(ULID_PATTERN).optional(),
  originalPrintJobId: z.string().regex(ULID_PATTERN).optional(),
});
