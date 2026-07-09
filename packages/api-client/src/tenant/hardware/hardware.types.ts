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
  version: number;
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
  /** Allows relocating a device to another branch (device move scenario). */
  branchId?: string;
  connectionType?: HardwareConnectionType;
  config?: Record<string, unknown>;
  status?: HardwareDeviceStatus;
  /** Optimistic-concurrency version from the record the editor last read. */
  version: number;
};

export type DeleteHardwareConfigRequest = {
  /** Optimistic-concurrency version from the record the editor last read. */
  version: number;
};
