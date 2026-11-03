export const hardwareDeviceTypeOptions = [
  { label: "Printer", value: "printer" },
  { label: "Scanner", value: "scanner" },
  { label: "Cash Drawer", value: "cash_drawer" },
] as const satisfies ReadonlyArray<{ label: string; value: string }>;

export const hardwareConnectionTypeOptions = [
  { label: "USB", value: "usb" },
  { label: "Bluetooth", value: "bluetooth" },
  { label: "Network", value: "network" },
  { label: "Other", value: "other" },
] as const satisfies ReadonlyArray<{ label: string; value: string }>;

export const hardwareDeviceStatusOptions = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
] as const satisfies ReadonlyArray<{ label: string; value: string }>;
