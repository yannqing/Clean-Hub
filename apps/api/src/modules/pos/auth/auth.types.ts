import type {
  AuthContext,
  AuthRequestMeta,
} from "../../auth/auth.types.js";

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

export type PosDeviceMutationResult = {
  device: PosDevice;
  setCookieHeaders: string[];
};

export type PosDeviceMutationInput<TData> = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: TData;
};

export type BindPosDeviceInput = PosDeviceMutationInput<BindPosDeviceRequest>;

export type UpdatePosDeviceInput =
  PosDeviceMutationInput<UpdatePosDeviceRequest> & {
    deviceId: string;
  };

export type RotatePosDeviceCredentialInput =
  PosDeviceMutationInput<RotatePosDeviceCredentialRequest> & {
    deviceId: string;
  };

export type SetTerminalLockInput =
  PosDeviceMutationInput<SetTerminalLockRequest> & {
    deviceId: string;
  };

export type GetPosDeviceInput = {
  authContext: AuthContext;
  deviceId: string;
};
