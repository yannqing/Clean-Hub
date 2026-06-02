import type { AuthContext } from "../auth/auth.types.js";

export type HardwareDeviceType = "printer" | "scanner" | "cash_drawer";
export type HardwareConnectionType = "usb" | "bluetooth" | "network" | "other";
export type HardwareDeviceStatus = "active" | "inactive";

export type HardwareConfigSummary = {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  deviceType: HardwareDeviceType;
  connectionType: HardwareConnectionType;
  config: Record<string, unknown>;
  status: HardwareDeviceStatus;
  createdAt: string;
  updatedAt: string;
};

export type ListHardwareConfigsQuery = {
  branchId?: string;
  deviceType?: HardwareDeviceType;
  status?: HardwareDeviceStatus;
  limit: number;
  offset: number;
};

export type CreateHardwareConfigData = {
  branchId: string;
  name: string;
  deviceType: HardwareDeviceType;
  connectionType: HardwareConnectionType;
  config?: Record<string, unknown>;
};

export type UpdateHardwareConfigData = {
  name?: string;
  connectionType?: HardwareConnectionType;
  config?: Record<string, unknown>;
  status?: HardwareDeviceStatus;
};

export type ListHardwareConfigsInput = {
  authContext: AuthContext;
  query: ListHardwareConfigsQuery;
};

export type CreateHardwareConfigInput = {
  authContext: AuthContext;
  data: CreateHardwareConfigData;
  requestMeta?: { ipAddress?: string; userAgent?: string };
};

export type UpdateHardwareConfigInput = {
  authContext: AuthContext;
  hardwareId: string;
  data: UpdateHardwareConfigData;
  requestMeta?: { ipAddress?: string; userAgent?: string };
};
