import type { ApiClient } from "../types";
import type {
  BindPosDeviceRequest,
  PosDevice,
  PosPinLoginRequest,
  PosPinLoginResult,
  PosTerminalState,
  SetTerminalLockRequest,
} from "./auth.types";

/**
 * POS-terminal-specific auth (PIN quick-login, device binding, terminal lock).
 * The platform-wide password login / refresh / logout live under
 * `posApi.auth` (modules/auth/); this namespace is the POS-specific layer.
 */
export function createPosTerminalAuthApi(client: ApiClient) {
  return {
    pinLogin: (input: PosPinLoginRequest) =>
      client.post<PosPinLoginResult>("/pos/auth/pin-login", input),
    bindDevice: (input: BindPosDeviceRequest) =>
      client.post<PosDevice>("/pos/auth/devices", input),
    getDevice: (deviceId: string) =>
      client.get<PosDevice>(`/pos/auth/devices/${deviceId}`),
    getTerminalState: (deviceId: string) =>
      client.get<PosTerminalState>(`/pos/auth/terminals/${deviceId}`),
    setTerminalLock: (deviceId: string, input: SetTerminalLockRequest) =>
      client.patch<PosTerminalState>(
        `/pos/auth/terminals/${deviceId}/lock`,
        input,
      ),
  };
}
