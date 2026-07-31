export type HardwareDeviceType = "printer" | "scanner" | "cash_drawer";
export type HardwareConnectionType = "usb" | "bluetooth" | "network" | "other";
export type HardwareDeviceStatus = "active" | "inactive";

export type HardwareConfigSummary = {
  id: string;
  tenantId: string;
  terminalId: string;
  terminalLabel: string | null;
  terminalDeviceId: string;
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
  terminalId: string;
  name: string;
  deviceType: HardwareDeviceType;
  connectionType: HardwareConnectionType;
  config?: Record<string, unknown>;
};

export type UpdateHardwareConfigRequest = {
  name?: string;
  /** Allows relocating a peripheral to a different POS terminal. */
  terminalId?: string;
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
