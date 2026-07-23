/**
 * POS hardware device — read-only DTOs.
 *
 * POS terminals can list hardware devices configured for their branch
 * but cannot create, update, or delete them (that belongs to web-admin).
 */

export type PosHardwareDeviceType = "printer" | "scanner" | "cash_drawer";

export type PosHardwareConnectionType = "usb" | "bluetooth" | "network" | "other";

export type PosHardwareDeviceStatus = "active" | "inactive";

export type PosHardwareDeviceSummary = {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  deviceType: PosHardwareDeviceType;
  connectionType: PosHardwareConnectionType;
  config: Record<string, unknown>;
  status: PosHardwareDeviceStatus;
  createdAt: string;
  updatedAt: string;
};

export type PosHardwareDeviceListResponse = {
  data: PosHardwareDeviceSummary[];
};

export type PosHardwareAction =
  | "manual_drawer_open"
  | "privileged_reprint";

export type AuthorizeManualDrawerOpenRequest = {
  reason: string;
};

export type AuthorizePrivilegedReprintRequest = {
  reason: string;
  documentType: "receipt" | "label";
  entityId?: string;
  originalPrintJobId?: string;
};

export type PosHardwareActionAuthorization = {
  authorizationId: string;
  action: PosHardwareAction;
  tenantId: string;
  branchId: string;
  terminalId: string;
  actorUserId: string;
  reason: string;
  authorizedAt: string;
};

export type PosPrintDocumentType = "receipt" | "label";

export type RecordPosPrintJobResultRequest = {
  jobId: string;
  documentType: PosPrintDocumentType;
  entityId: string;
  status: "printed" | "failed";
  attempt: number;
  error?: string;
  authorizationId?: string;
  originalPrintJobId?: string;
};

export type PosPrintJobAuditResult = {
  jobId: string;
  status: RecordPosPrintJobResultRequest["status"];
  attempt: number;
  recorded: boolean;
  idempotent: boolean;
};
