import type { AuthContext } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

type BrowserLoginInput = {
  identifier: string;
  password: string;
  tenantCode?: string;
  deviceId: string;
};

export async function loginBrowserSessionAction(
  input: BrowserLoginInput,
): Promise<AuthContext> {
  const result = await webAdminApi.auth.login(input);

  return result.authContext;
}

export async function logoutBrowserSessionAction(): Promise<void> {
  await webAdminApi.auth.logout();
}
