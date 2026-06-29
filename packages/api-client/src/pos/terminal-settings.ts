import type { ApiClient, QueryValue } from "../types";
import type {
  CreatePosTerminalSettingsRequest,
  PosTerminalSettings,
  UpdatePosTerminalSettingsRequest,
} from "./terminal-settings.types";

type GetOptions = {
  deviceId: string;
};

export function createPosTerminalSettingsApi(client: ApiClient) {
  return {
    get: (options: GetOptions) =>
      client.get<PosTerminalSettings>("/pos/terminal-settings", {
        query: { deviceId: options.deviceId as QueryValue },
      }),
    create: (input: CreatePosTerminalSettingsRequest) =>
      client.post<PosTerminalSettings>("/pos/terminal-settings", input),
    update: (deviceId: string, input: UpdatePosTerminalSettingsRequest) =>
      client.patch<PosTerminalSettings>("/pos/terminal-settings", input, {
        query: { deviceId: deviceId as QueryValue },
      }),
  };
}
