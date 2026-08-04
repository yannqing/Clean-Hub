export type PosDeviceStatus = "active" | "inactive";

export type PosDevice = {
  id: string;
  deviceId: string;
  label: string | null;
  branchId: string;
  status: PosDeviceStatus;
  credentialVersion: number;
  credentialIssuedAt: string | null;
  credentialRotatedAt: string | null;
  credentialLastUsedAt: string | null;
  lastSeenAt: string | null;
  boundAt: string;
  updatedAt: string;
};

export type BindPosDeviceRequest = {
  deviceId: string;
  label: string;
  branchId: string;
  /** Runtime data reported by the terminal during its first enrollment. */
  deviceType?: "unknown" | "desktop" | "tablet" | "phone" | "browser";
  platform?: string | null;
  platformVersion?: string | null;
  appVersion?: string | null;
};

export type UpdatePosDeviceRequest = {
  branchId?: string;
  label?: string;
  status?: PosDeviceStatus;
  reason: string;
};

export type RotatePosDeviceCredentialRequest = {
  reason: string;
};

export type RevokePosDeviceRequest = {
  reason: string;
};

export type PosTerminalLockState = "locked" | "unlocked";

export type PosTerminalState = {
  deviceId: string;
  lockState: PosTerminalLockState;
  lockedAt: string | null;
  lockedByStaffId: string | null;
};

export type SetTerminalLockRequest = {
  lockState: PosTerminalLockState;
  reason: string;
};
