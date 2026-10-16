/**
 * POS hardware device DTOs. Manual device lifecycle belongs to web-admin;
 * built-in discovery/registration and local printer binding are performed by
 * the enrolled terminal.
 */

export type PosHardwareDeviceType = "printer" | "scanner" | "cash_drawer";

export type PosHardwareConnectionType =
  | "usb"
  | "bluetooth"
  | "network"
  | "other";

export type PosHardwareDeviceStatus = "active" | "inactive";
export type PosHardwarePrinterPurpose = "receipt" | "label";
export type PosHardwareProvisioningMode = "manual" | "built_in";
export type PosBuiltInHardwareKey =
  `${string}:built-in:${"printer" | "scanner"}`;

export type PosHardwareDeviceSummary = {
  id: string;
  tenantId: string;
  terminalId: string;
  name: string;
  deviceType: PosHardwareDeviceType;
  connectionType: PosHardwareConnectionType;
  provisioningMode: PosHardwareProvisioningMode;
  hardwareKey: string | null;
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

export type ConnectPosBuiltInHardwareRequest = {
  hardwareKey: PosBuiltInHardwareKey;
  name: string;
  deviceType: Extract<PosHardwareDeviceType, "printer" | "scanner">;
  localDeviceId: string;
  deviceModel?: string;
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
