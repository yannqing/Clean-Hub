import type { PosHardwareDeviceSummary } from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";

import { getPosOfflineStorage } from "./desktop-bridge";

export type PosHardwareCacheScope = {
  tenantId: string;
  branchId: string;
  terminalId: string;
};

function buildHardwareCacheKey(scope: PosHardwareCacheScope): string {
  return [
    "cleanhub.pos.offline.hardware.v1",
    scope.tenantId,
    scope.branchId,
    scope.terminalId,
  ].join(":");
}

async function readCachedDevices(
  scope: PosHardwareCacheScope,
): Promise<PosHardwareDeviceSummary[]> {
  const value = await getPosOfflineStorage().getItem(
    buildHardwareCacheKey(scope),
  );
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as PosHardwareDeviceSummary[]) : [];
  } catch {
    return [];
  }
}

async function writeCachedDevices(
  scope: PosHardwareCacheScope,
  devices: PosHardwareDeviceSummary[],
): Promise<void> {
  await getPosOfflineStorage().setItem(
    buildHardwareCacheKey(scope),
    JSON.stringify(devices),
  );
}

/** Online refresh with a tenant/branch/terminal-scoped offline fallback. */
export async function loadPosHardwareDevices(
  scope: PosHardwareCacheScope,
): Promise<PosHardwareDeviceSummary[]> {
  if (typeof navigator === "undefined" || navigator.onLine) {
    try {
      const devices = (await posApi.pos.hardware.list()).data;
      await writeCachedDevices(scope, devices);
      return devices;
    } catch {
      // The request may have failed after a connectivity transition. The last
      // known terminal-scoped configuration is safer than losing cash-drawer
      // support in the middle of a durable offline sale.
    }
  }
  return readCachedDevices(scope);
}
