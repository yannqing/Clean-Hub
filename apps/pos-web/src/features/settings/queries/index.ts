/**
 * 设置 — data access via the shared api-client.
 *
 * Thin wrappers around `posApi.pos.terminalSettings` so components do not
 * import the client directly.
 */

import type {
  PosTerminalSettings,
  UpdatePosTerminalSettingsRequest,
} from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";

/** Fetch terminal settings for the current device. */
export async function fetchTerminalSettings(
  deviceId: string,
): Promise<PosTerminalSettings> {
  return posApi.pos.terminalSettings.get({ deviceId });
}

/** Update terminal settings for the current device. */
export async function updateTerminalSettings(
  deviceId: string,
  input: UpdatePosTerminalSettingsRequest,
): Promise<PosTerminalSettings> {
  return posApi.pos.terminalSettings.update(deviceId, input);
}
