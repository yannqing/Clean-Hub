export type OperationLogLevel = "debug" | "info" | "warn" | "error";

export type OperationLogListInput = {
  level?: OperationLogLevel;
  service?: string;
  tenantId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit: number;
  offset: number;
};

export type OperationLogListItem = {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  level: OperationLogLevel;
  service: string;
  eventType: string;
  message: string;
  requestId: string | null;
  actorUserId: string | null;
  createdAt: string;
};
