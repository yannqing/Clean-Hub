import { webAdminApi } from "@/lib/api-client";

import type { SaasUserDetail } from "../types";

export async function getSaasUserDetailQuery(
  userId: string,
): Promise<SaasUserDetail> {
  return webAdminApi.saas.users.get(userId);
}
