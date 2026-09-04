/**
 * POS hardware device DTOs. Lifecycle management belongs to web-admin; local
 * printer binding is performed from the enrolled terminal.
 */

export type PosHardwareDeviceType = "printer" | "scanner" | "cash_drawer";

export type PosHardwareConnectionType =
  | "usb"
  | "bluetooth"
  | "network"
  | "other";

export type PosHardwareDeviceStatus = "active" | "inactive";

export type PosHardwareDeviceSummary = {
  id: string;
  tenantId: string;
  terminalId: string;
  name: string;
  deviceType: PosHardwareDeviceType;
  connectionType: PosHardwareConnectionType;
  config: Record<string, unknown>;
  status: PosHardwareDeviceStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type BindPosPrinterRequest = {
  printerId: string;
  printerName: string;
  isDefault?: boolean;
  version: number;
};

export type PosHardwareDeviceListResponse = {
  data: PosHardwareDeviceSummary[];
};

export type PosHardwareAction = "manual_drawer_open" | "privileged_reprint";

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

export type RecordCashPaymentDrawerResultRequest = {
  paymentId: string;
  status: "opened" | "failed";
  attempt: number;
  printerId?: string;
  error?: string;
};

export type PosCashPaymentDrawerAuditResult = {
  paymentId: string;
  status: RecordCashPaymentDrawerResultRequest["status"];
  attempt: number;
  recorded: boolean;
  idempotent: boolean;
};
