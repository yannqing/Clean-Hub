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

/** Fetch settings for the terminal resolved from the authenticated session. */
export async function fetchTerminalSettings(): Promise<PosTerminalSettings> {
  return posApi.pos.terminalSettings.get();
}

/** Update settings for the terminal resolved from the authenticated session. */
export async function updateTerminalSettings(
  input: UpdatePosTerminalSettingsRequest,
): Promise<PosTerminalSettings> {
  return posApi.pos.terminalSettings.update(input);
}
