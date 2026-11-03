import type {
  ApiRequestOptions,
  AuthContext,
  LoginRequest,
  PosBootstrapResponse,
  TenantProfile,
} from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";

export async function fetchTerminalBootstrap(
  deviceId: string,
  options: Omit<ApiRequestOptions, "method" | "body" | "query"> = {},
): Promise<PosBootstrapResponse> {
  return posApi.auth.posBootstrap({ deviceId }, options);
}

export async function loginSetupAdministrator(
  input: LoginRequest,
): Promise<AuthContext> {
  const result = await posApi.auth.login(input);
  return result.authContext;
}

export async function fetchSetupTenantProfile(): Promise<TenantProfile> {
  return posApi.tenant.profile.get();
}

export async function fetchSetupAuthContext(
  options: Omit<ApiRequestOptions, "method" | "body" | "query"> = {},
): Promise<AuthContext> {
  return posApi.auth.me(options);
}

export async function enrollCurrentTerminal(input: {
  deviceId: string;
  label: string;
  branchId: string;
}) {
  return posApi.pos.terminalAuth.bindDevice(input);
}

export async function recoverCurrentTerminal(deviceId: string) {
  return posApi.pos.terminalAuth.rotateCredential(deviceId, {
    reason: "Restore credential on the enrolled terminal",
  });
}

export async function logoutSetupAdministrator(): Promise<void> {
  await posApi.auth.logout();
}
