import type { AsyncKeyValueStorage } from "@cleanhub/offline";

import type { PosRuntimeConfig } from "./pos-runtime-config";

const POS_OFFLINE_RUNTIME_STORAGE_KEY = "cleanhub:pos-runtime:v1";
const POS_OFFLINE_RUNTIME_VERSION = 1;
const MAX_RUNTIME_AGE_MS = 8 * 60 * 60 * 1_000;

type PosOfflineRuntimeSnapshot = {
  version: typeof POS_OFFLINE_RUNTIME_VERSION;
  updatedAt: string;
  runtime: PosRuntimeConfig;
};

function isRuntimeUsable(value: PosRuntimeConfig): boolean {
  return Boolean(
    value.tenantId &&
      value.branchId &&
      value.terminalId &&
      value.userId &&
      value.terminalCredentialVersion,
  );
}

function toOfflineRuntime(runtime: PosRuntimeConfig): PosRuntimeConfig {
  return {
    ...runtime,
    // A name is not needed for offline queuing or receipts. Do not retain a
    // staff member's display name after the signed-in session is unavailable.
    operatorName: null,
  };
}

export async function readPosOfflineRuntime(
  storage: AsyncKeyValueStorage,
  options: { now?: number } = {},
): Promise<PosRuntimeConfig | null> {
  const stored = await storage.getItem(POS_OFFLINE_RUNTIME_STORAGE_KEY);
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored) as Partial<PosOfflineRuntimeSnapshot>;
    if (
      parsed.version !== POS_OFFLINE_RUNTIME_VERSION ||
      typeof parsed.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(parsed.updatedAt)) ||
      !parsed.runtime ||
      !isRuntimeUsable(parsed.runtime)
    ) {
      return null;
    }
    const age = (options.now ?? Date.now()) - Date.parse(parsed.updatedAt);
    if (age < -5 * 60 * 1_000 || age > MAX_RUNTIME_AGE_MS) return null;
    return parsed.runtime;
  } catch {
    return null;
  }
}

export async function writePosOfflineRuntime(
  storage: AsyncKeyValueStorage,
  runtime: PosRuntimeConfig,
  options: { updatedAt?: string } = {},
): Promise<boolean> {
  if (!isRuntimeUsable(runtime)) return false;

  const snapshot: PosOfflineRuntimeSnapshot = {
    version: POS_OFFLINE_RUNTIME_VERSION,
    updatedAt: options.updatedAt ?? new Date().toISOString(),
    runtime: toOfflineRuntime(runtime),
  };
  await storage.setItem(POS_OFFLINE_RUNTIME_STORAGE_KEY, JSON.stringify(snapshot));
  return true;
}
