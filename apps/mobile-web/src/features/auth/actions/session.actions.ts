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

function isSessionExpired(refreshTokenExpiresAt: string): boolean {
  const expiresAt = new Date(refreshTokenExpiresAt).getTime();

  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

export async function loadStoredAuthState() {
  const [tenantCode, storedSession, deviceId] = await Promise.all([
    getTenantCode(),
    getMobileSession(),
    getOrCreateDeviceId(),
  ]);

  let session = storedSession;

  if (session && isSessionExpired(session.refreshTokenExpiresAt)) {
    await clearMobileSession();
    session = null;
  }

  return {
    tenantCode,
    session,
    deviceId,
  };
}

export async function enterTenantContext(input: string): Promise<string> {
  const tenantCode = input.normalize("NFKC").trim().toUpperCase();

  if (!/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(tenantCode)) {
    throw new Error("auth.tenant.invalidCode");
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
