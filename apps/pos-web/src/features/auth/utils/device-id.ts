"use client";

import { createId } from "@cleanhub/id";

/**
 * Stable per-device identifier used by auth (refresh-token binding, audit).
 *
 * Resolution order (first non-empty wins):
 *   1. POS_DEVICE_ID env var — set by the Electron main process or the
 *      Capacitor native layer for a real hardware-bound id (recommended for
 *      shared POS terminals).
 *   2. Native bridge hook `CleanHubPos.getDeviceId()` — a placeholder for the
 *      future Capacitor plugin that exposes IDFV / machine id. Returns null
 *      until the bridge is present.
 *   3. localStorage persisted ULID — the web default, generated on first use.
 *
 * The SSR fallback ("pos-web-server") mirrors web-admin and is only used when
 * this runs on the server (where window/localStorage are unavailable).
 */

const POS_DEVICE_ID_KEY = "cleanhub.pos-web.device-id";
const SSR_DEVICE_ID = "pos-web-server";

type CleanHubPosBridge = {
  getDeviceId?: () => string | null;
};

declare global {
  interface Window {
    CleanHubPos?: CleanHubPosBridge;
  }
}

function readEnvDeviceId(): string | null {
  const value =
    process.env.POS_DEVICE_ID ?? process.env.NEXT_PUBLIC_POS_DEVICE_ID;
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function readNativeDeviceId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.CleanHubPos?.getDeviceId?.() ?? null;
  } catch {
    return null;
  }
}

function readOrCreateLocalDeviceId(): string {
  const existing = window.localStorage.getItem(POS_DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const deviceId = createId();
  window.localStorage.setItem(POS_DEVICE_ID_KEY, deviceId);
  return deviceId;
}

/**
 * Resolve the current POS device id. Returns the env / native value when
 * available (Electron / Capacitor), otherwise falls back to a localStorage
 * ULID. Use this on the login form and anywhere auth needs a device id.
 */
export function getPosDeviceIdSync(): string {
  if (typeof window === "undefined") {
    return SSR_DEVICE_ID;
  }

  return (
    readEnvDeviceId() ?? readNativeDeviceId() ?? readOrCreateLocalDeviceId()
  );
}

/** Backwards-compatible alias kept for the login form. */
export const getOrCreatePosDeviceId = getPosDeviceIdSync;
