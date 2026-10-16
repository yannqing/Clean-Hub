import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  PosTerminalHeartbeatRequest,
  PosTerminalSettings,
  UpdatePosTerminalSettingsRequest,
} from "./terminal-settings.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createPosTerminalSettingsApi(client: ApiClient) {
  return {
    // Terminal identity is resolved from the authenticated terminal session.
    // Never accept a caller-provided device, branch, or terminal identifier.
    get: (options?: RequestOptions) =>
      client.get<PosTerminalSettings>("/pos/terminal-settings", options),
    update: (input: UpdatePosTerminalSettingsRequest) =>
      client.patch<PosTerminalSettings>("/pos/terminal-settings", input),
    heartbeat: (input: PosTerminalHeartbeatRequest) =>
      client.post<PosTerminalSettings>(
        "/pos/terminal-settings/heartbeat",
        input,
      ),
  };
}
