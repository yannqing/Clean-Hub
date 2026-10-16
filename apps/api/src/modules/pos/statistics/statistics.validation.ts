import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const ulidSchema = z.string().regex(ULID_PATTERN);

export const posStatisticsPeriodSchema = z.enum([
  "today",
  "week",
  "month",
  "all",
]);

export const posStatisticsQuerySchema = z.object({
  period: posStatisticsPeriodSchema.default("today"),
  branchId: ulidSchema.optional(),
});

export const posStatisticsCustomerQuerySchema = z.object({
  branchId: ulidSchema.optional(),
});
