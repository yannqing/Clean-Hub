"use client";

import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";
import { Preferences } from "@capacitor/preferences";
import { createId } from "@cleanhub/id";

/**
 * Stable per-device identifier used by auth (refresh-token binding, audit).
 *
 * Resolution order (first non-empty wins):
 *   1. POS_DEVICE_ID env var — useful for a managed Electron deployment.
 *   2. An existing native bridge value (kept for Electron compatibility).
 *   3. Capacitor Preferences — the authoritative per-installation value on
 *      iOS/Android. A legacy localStorage value is migrated when present.
 *   4. localStorage persisted ULID — the regular browser fallback.
 *
 * Auth credentials are deliberately not stored here. Access/refresh tokens
 * remain HttpOnly cookies; Preferences stores only the non-secret device id.
 */

const POS_DEVICE_ID_KEY = "cleanhub.pos-web.device-id";
const NATIVE_POS_DEVICE_ID_KEY = "cleanhub.pos.installation-device-id.v1";
const SSR_DEVICE_ID = "pos-web-server";
const MAX_DEVICE_ID_LENGTH = 128;

type CleanHubPosBridge = {
  getDeviceId?: () => string | null | Promise<string | null>;
};

declare global {
  interface Window {
    CleanHubPos?: CleanHubPosBridge;
  }
}

let resolvedDeviceId: string | null = null;
let pendingDeviceId: Promise<string> | null = null;

function normalizeDeviceId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length > MAX_DEVICE_ID_LENGTH) {
    return null;
  }

  return trimmed;
}

function readEnvDeviceId(): string | null {
  const value =
    process.env.POS_DEVICE_ID ?? process.env.NEXT_PUBLIC_POS_DEVICE_ID;
  return normalizeDeviceId(value);
}

function readNativeDeviceIdSync(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.CleanHubPos?.getDeviceId?.();
    return typeof value === "string" ? normalizeDeviceId(value) : null;
  } catch {
    return null;
  }
}

async function readNativeBridgeDeviceId(): Promise<string | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return normalizeDeviceId(await window.CleanHubPos?.getDeviceId?.());
  } catch {
    return null;
  }
}

function readLocalDeviceId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return normalizeDeviceId(window.localStorage.getItem(POS_DEVICE_ID_KEY));
  } catch {
    return null;
  }
}

function writeLocalDeviceId(deviceId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(POS_DEVICE_ID_KEY, deviceId);
  } catch {
    // Preferences remains authoritative in a native shell. Browsers that
    // disable storage still receive a stable id for the current page lifetime.
  }
}

function readOrCreateLocalDeviceId(): string {
  const existing = readLocalDeviceId();
  if (existing) {
    return existing;
  }

  const deviceId = createId();
  writeLocalDeviceId(deviceId);
  return deviceId;
}

async function derivePrivateNativeDeviceId(): Promise<string> {
  try {
    const nativeId = normalizeDeviceId((await Device.getId()).identifier);
    if (nativeId && globalThis.crypto?.subtle) {
      const input = new TextEncoder().encode(`com.cleanhub.pos:${nativeId}`);
      const digest = await globalThis.crypto.subtle.digest("SHA-256", input);
      const hash = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");

      return `pos-native-${hash}`;
    }
  } catch {
    // Fall through to a generated installation id when the plugin is absent
    // or the platform does not expose a device identifier.
  }

  return createId();
}

async function readOrCreateCapacitorDeviceId(): Promise<string> {
  try {
    const stored = normalizeDeviceId(
      (await Preferences.get({ key: NATIVE_POS_DEVICE_ID_KEY })).value,
    );
    if (stored) {
      writeLocalDeviceId(stored);
      return stored;
    }

    const deviceId = readLocalDeviceId() ?? (await derivePrivateNativeDeviceId());
    await Preferences.set({
      key: NATIVE_POS_DEVICE_ID_KEY,
      value: deviceId,
    });
    writeLocalDeviceId(deviceId);
    return deviceId;
  } catch {
    // A WebView must remain usable if a native plugin is temporarily
    // unavailable (for example before `cap sync` during development).
    return readOrCreateLocalDeviceId();
  }
}

/**
 * Synchronous compatibility accessor for display-only callers. Login and
 * terminal registration should await `getOrCreatePosDeviceId()` so Capacitor
 * Preferences can be consulted before the id is sent to the API.
 */
export function getPosDeviceIdSync(): string {
  if (typeof window === "undefined") {
    return SSR_DEVICE_ID;
  }

  const authoritativeDeviceId =
    resolvedDeviceId ?? readEnvDeviceId() ?? readNativeDeviceIdSync();
  if (authoritativeDeviceId) {
    resolvedDeviceId = authoritativeDeviceId;
    return authoritativeDeviceId;
  }

  const localDeviceId = readOrCreateLocalDeviceId();
  if (!Capacitor.isNativePlatform()) {
    resolvedDeviceId = localDeviceId;
  }

  // On native, do not cache this synchronous fallback as authoritative:
  // Preferences may contain an older registered terminal id. The async
  // resolver must always get a chance to read and restore that value.
  return localDeviceId;
}

/**
 * Resolve the stable POS installation id.
 *
 * Native shells persist it in Capacitor Preferences and browsers persist it
 * in localStorage. Calls are coalesced so concurrent login/setup requests
 * cannot generate different ids.
 */
export async function getOrCreatePosDeviceId(): Promise<string> {
  if (typeof window === "undefined") {
    return SSR_DEVICE_ID;
  }

  if (resolvedDeviceId) {
    return resolvedDeviceId;
  }

  pendingDeviceId ??= (async () => {
    const configured = readEnvDeviceId();
    if (configured) {
      return configured;
    }

    const bridged = await readNativeBridgeDeviceId();
    if (bridged) {
      return bridged;
    }

    return Capacitor.isNativePlatform()
      ? readOrCreateCapacitorDeviceId()
      : readOrCreateLocalDeviceId();
  })();

  try {
    resolvedDeviceId = await pendingDeviceId;
    return resolvedDeviceId;
  } finally {
    pendingDeviceId = null;
  }
}
