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

export type OperationLogDetail = OperationLogListItem & {
  metadata: Record<string, unknown> | null;
};

export type OperationLogListResult = {
  items: OperationLogListItem[];
  total: number;
  limit: number;
  offset: number;
};

export type WriteOperationLogInput = {
  tenantId?: string | null;
  branchId?: string | null;
  level?: OperationLogLevel;
  service: string;
  eventType: string;
  message: string;
  requestId?: string;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
};
