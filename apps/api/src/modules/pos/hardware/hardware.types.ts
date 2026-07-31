import type {
  AuthContext,
  AuthRequestMeta,
} from "../../auth/auth.types.js";

/**
 * POS hardware device — read-only DTOs.
 *
 * The POS terminal can list peripherals configured specifically for itself
 * but cannot create, update, or delete them (that belongs to web-admin).
 */

export type PosHardwareDeviceType = "printer" | "scanner" | "cash_drawer";

export type PosHardwareConnectionType = "usb" | "bluetooth" | "network" | "other";

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

export type AuthorizePosHardwareActionInput<TData> = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: TData;
};
