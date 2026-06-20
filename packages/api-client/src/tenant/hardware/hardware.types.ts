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

export type CreateHardwareConfigRequest = {
  branchId: string;
  name: string;
  deviceType: HardwareDeviceType;
  connectionType: HardwareConnectionType;
  config?: Record<string, unknown>;
};

export type UpdateHardwareConfigRequest = {
  name?: string;
  connectionType?: HardwareConnectionType;
  config?: Record<string, unknown>;
  status?: HardwareDeviceStatus;
};
