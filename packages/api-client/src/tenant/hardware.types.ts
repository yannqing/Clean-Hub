export type DeviceType =
  | "printer"
  | "scanner"
  | "cash_drawer"
  | "display"
  | "other";

export type DeviceConnectionType =
  | "usb"
  | "bluetooth"
  | "network"
  | "browser"
  | "other";

export type DeviceStatus = "active" | "disabled";

export type DeviceSummary = {
  id: string;
  name: string;
  type: DeviceType;
  branchId: string;
  connectionType: DeviceConnectionType;
  status: DeviceStatus;
};
