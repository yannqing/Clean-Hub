import "server-only";

import type { PosTerminalSettings } from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

/**
 * Fetch the terminal settings for the authenticated terminal session on the
 * server (same pattern as `features/branches/queries/get-my-branch.query.ts`).
 *
 * Deliberately NOT re-exported from `./index.ts`: that barrel is imported by
 * client components (settings-view), while this file is server-only. Import it
 * directly by path from server components, e.g. the `(pos)` layout.
 */
export async function getTerminalSettingsQuery(): Promise<PosTerminalSettings> {
  const options = await getPosServerApiRequestOptions();
  return posApi.pos.terminalSettings.get(options);
}
