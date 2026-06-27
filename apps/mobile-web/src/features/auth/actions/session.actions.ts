import type { MobileTokenResponse } from "@cleanhub/api-client";

import {
  clearMobileSession,
  clearTenantCode,
  getMobileSession,
  getOrCreateDeviceId,
  getTenantCode,
  saveMobileSession,
  saveTenantCode,
} from "@/lib/token-storage";

export async function loadStoredAuthState() {
  const [tenantCode, session, deviceId] = await Promise.all([
    getTenantCode(),
    getMobileSession(),
    getOrCreateDeviceId(),
  ]);

  return {
    tenantCode,
    session,
    deviceId,
  };
}

export async function enterTenantContext(input: string): Promise<string> {
  const tenantCode = input.trim().toUpperCase();

  if (!/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(tenantCode)) {
    throw new Error("Saisissez un code pressing valide.");
  }

  await saveTenantCode(tenantCode);
  return tenantCode;
}

export async function persistLoginResponse(response: MobileTokenResponse) {
  await saveMobileSession(response);
  return {
    authContext: response.authContext,
  };
}

export async function resetTenantContext(): Promise<void> {
  await Promise.all([clearTenantCode(), clearMobileSession()]);
}

export async function logoutLocally(): Promise<void> {
  await clearMobileSession();
}
