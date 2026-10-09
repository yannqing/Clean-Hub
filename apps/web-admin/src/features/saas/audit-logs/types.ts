export type {
  AuditLogDetail,
  AuditLogListResult,
  AuditLogSummary,
} from "@cleanhub/api-client";

export type AuditLogListQuery = {
  limit?: number;
  offset?: number;
  actorUserId?: string;
  eventCategory?: string;
  eventType?: string;
  success?: "true" | "false";
  dateFrom?: string;
  dateTo?: string;
};
