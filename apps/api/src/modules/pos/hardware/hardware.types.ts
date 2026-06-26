/**
 * POS hardware device — read-only DTOs.
 *
 * The POS terminal can list hardware devices configured for its branch
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
