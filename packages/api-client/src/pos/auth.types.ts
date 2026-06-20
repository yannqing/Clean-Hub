export type PosDeviceStatus = "active" | "revoked";

export type PosDevice = {
  id: string;
  deviceId: string;
  label: string;
  branchId: string;
  status: PosDeviceStatus;
  lastSeenAt: string | null;
  boundAt: string;
};

export type PosPinLoginRequest = {
  pin: string;
  deviceId: string;
};

export type PosPinLoginResult = {
  success: boolean;
  staffId: string | null;
  attemptRemaining: number | null;
};

export type BindPosDeviceRequest = {
  deviceId: string;
  label: string;
  branchId: string;
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
};
