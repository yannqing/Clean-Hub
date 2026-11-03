import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const ulidSchema = z.string().regex(ULID_PATTERN);

export const posWorkspaceOverviewQuerySchema = z.object({
  branchId: ulidSchema.optional(),
});

export const posWorkspaceActivitiesQuerySchema = z.object({
  branchId: ulidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const posWorkspaceTasksQuerySchema = z.object({
  branchId: ulidSchema.optional(),
});
