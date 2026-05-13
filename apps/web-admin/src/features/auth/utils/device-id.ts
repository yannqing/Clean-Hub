"use client";

import { createId } from "@cleanhub/id";

const WEB_ADMIN_DEVICE_ID_KEY = "cleanhub.web-admin.device-id";

function createDeviceId(): string {
  return createId();
}

export function getOrCreateWebAdminDeviceId(): string {
  if (typeof window === "undefined") {
    return "web-admin-server";
  }

  const existingDeviceId = window.localStorage.getItem(WEB_ADMIN_DEVICE_ID_KEY);

  if (existingDeviceId) {
    return existingDeviceId;
  }

  const deviceId = createDeviceId();
  window.localStorage.setItem(WEB_ADMIN_DEVICE_ID_KEY, deviceId);

  return deviceId;
}
