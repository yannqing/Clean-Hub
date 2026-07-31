import type { ApiClient } from "../types";
import type {
  PosTerminalHeartbeatRequest,
  PosTerminalSettings,
  UpdatePosTerminalSettingsRequest,
} from "./terminal-settings.types";

export function createPosTerminalSettingsApi(client: ApiClient) {
  return {
    // Terminal identity is resolved from the authenticated terminal session.
    // Never accept a caller-provided device, branch, or terminal identifier.
    get: () => client.get<PosTerminalSettings>("/pos/terminal-settings"),
    update: (input: UpdatePosTerminalSettingsRequest) =>
      client.patch<PosTerminalSettings>("/pos/terminal-settings", input),
    heartbeat: (input: PosTerminalHeartbeatRequest) =>
      client.post<PosTerminalSettings>(
        "/pos/terminal-settings/heartbeat",
        input,
      ),
  };
}
