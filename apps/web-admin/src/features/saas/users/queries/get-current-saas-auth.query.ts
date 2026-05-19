import { webAdminApi } from "@/lib/api-client";

import type { AuthContext } from "../types";

export async function getCurrentSaasAuthQuery(): Promise<AuthContext> {
  return webAdminApi.auth.me();
}
