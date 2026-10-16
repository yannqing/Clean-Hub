"use client";

import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";
import type { BindPosDeviceRequest } from "@cleanhub/api-client";

import packageManifest from "../../../package.json";
import { getDesktopBridge } from "@/features/hardware/lib/desktop-bridge";

export type PosTerminalRuntimeMetadata = Pick<
  BindPosDeviceRequest,
  "deviceType" | "platform" | "platformVersion" | "appVersion"
>;

const MAX_RUNTIME_VALUE_LENGTH = 64;
const POS_APP_VERSION = packageManifest.version || "0.1.0";

function normalizeRuntimeValue(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim();
  return normalized && normalized.length <= MAX_RUNTIME_VALUE_LENGTH
    ? normalized
    : null;
}

function getBrowserPlatform(): string | null {
  if (typeof navigator === "undefined") {
    return null;
  }

  return normalizeRuntimeValue(navigator.platform) ?? "web";
}

function isTabletModel(model: string, userAgent: string): boolean {
  return (
    /ipad|tablet|tab\b|pad\b/i.test(model) ||
    /ipad|tablet|\btab\b|\bpad\b/i.test(userAgent) ||
    // Modern iPadOS can identify itself as macOS in the user agent. Touch
    // support distinguishes it from an Electron/macOS POS terminal.
    (typeof navigator !== "undefined" &&
      navigator.maxTouchPoints > 1 &&
      /macintosh/i.test(userAgent))
  );
}

function resolveNativeDeviceType(input: {
  model: string;
  platform: string;
}): NonNullable<PosTerminalRuntimeMetadata["deviceType"]> {
  if (input.platform === "ios") {
    return isTabletModel(input.model, navigator.userAgent) ? "tablet" : "phone";
  }

  if (input.platform === "android") {
    return isTabletModel(input.model, navigator.userAgent) ? "tablet" : "phone";
  }

  return "browser";
}

/**
 * Report only non-sensitive terminal runtime facts. Device identifiers and
 * authentication credentials intentionally remain outside this payload.
 */
export async function getPosTerminalRuntimeMetadata(): Promise<PosTerminalRuntimeMetadata> {
  const appVersion = normalizeRuntimeValue(POS_APP_VERSION);

  if (getDesktopBridge()) {
    return {
      deviceType: "desktop",
      platform: getBrowserPlatform() ?? "electron",
      platformVersion: null,
      appVersion,
    };
  }

  if (!Capacitor.isNativePlatform()) {
    return {
      deviceType: "browser",
      platform: getBrowserPlatform() ?? "web",
      platformVersion: null,
      appVersion,
    };
  }

  try {
    const info = await Device.getInfo();
    const platform = normalizeRuntimeValue(
      info.operatingSystem ?? info.platform,
    );
    return {
      deviceType: resolveNativeDeviceType({
        model: info.model,
        platform: info.platform,
      }),
      platform: platform ?? "native",
      platformVersion: normalizeRuntimeValue(info.osVersion),
      appVersion,
    };
  } catch {
    const platform = normalizeRuntimeValue(Capacitor.getPlatform());
    return {
      deviceType: "browser",
      platform: platform ?? "native",
      platformVersion: null,
      appVersion,
    };
  }
}
