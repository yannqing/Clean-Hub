/**
 * POS terminal authentication — DTOs.
 *
 * POS-specific auth on top of the platform-wide login (modules/auth/):
 * PIN quick-login, device binding, and terminal lock/unlock. Scaffold only.
 */
import type { AuthRequestMeta } from "../../auth/auth.types.js";

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

/** Quick PIN login (after the device is already bound to a session). */
export type PosPinLoginRequest = {
  pin: string;
  deviceId: string;
};

export type PosPinLoginResult = {
  success: boolean;
  staffId: string | null;
  attemptRemaining: number | null;
};

/** Bind a physical device to a tenant/branch. */
export type BindPosDeviceRequest = {
  deviceId: string;
  label: string;
  branchId: string;
};

/** Terminal lock/unlock during an active shift (cashier steps away). */
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

export type PosPinLoginInput = {
  requestMeta?: AuthRequestMeta;
  data: PosPinLoginRequest;
};

export type BindPosDeviceInput = {
  requestMeta?: AuthRequestMeta;
  data: BindPosDeviceRequest;
};

export type SetTerminalLockInput = {
  requestMeta?: AuthRequestMeta;
  data: SetTerminalLockRequest;
};

export type GetPosDeviceInput = {
  deviceId: string;
};
