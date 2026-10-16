import type { ApiClient } from "../types";
import type {
  BindPosDeviceRequest,
  PosDevice,
  PosTerminalState,
  RevokePosDeviceRequest,
  RotatePosDeviceCredentialRequest,
  SetTerminalLockRequest,
  UpdatePosDeviceRequest,
} from "./auth.types";

/**
 * POS terminal enrollment and management. PIN login remains under
 * `posApi.auth` so it can establish the normal HttpOnly auth cookies.
 */
export function createPosTerminalAuthApi(client: ApiClient) {
  return {
    bindDevice: (input: BindPosDeviceRequest) =>
      client.post<PosDevice>("/pos/auth/devices", input),
    getDevice: (deviceId: string) =>
      client.get<PosDevice>(`/pos/auth/devices/${deviceId}`),
    updateDevice: (deviceId: string, input: UpdatePosDeviceRequest) =>
      client.patch<PosDevice>(`/pos/auth/devices/${deviceId}`, input),
    rotateCredential: (
      deviceId: string,
      input: RotatePosDeviceCredentialRequest,
    ) =>
      client.post<PosDevice>(
        `/pos/auth/devices/${deviceId}/credential-rotation`,
        input,
      ),
    revokeDevice: (deviceId: string, input: RevokePosDeviceRequest) =>
      client.post<PosDevice>(`/pos/auth/devices/${deviceId}/revocation`, input),
    getTerminalState: (deviceId: string) =>
      client.get<PosTerminalState>(`/pos/auth/terminals/${deviceId}`),
    setTerminalLock: (deviceId: string, input: SetTerminalLockRequest) =>
      client.patch<PosTerminalState>(
        `/pos/auth/terminals/${deviceId}/lock`,
        input,
      ),
  };
}
