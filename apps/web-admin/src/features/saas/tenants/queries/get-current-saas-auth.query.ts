import { webAdminApi } from "@/lib/api-client";

export async function getCurrentSaasAuthQuery() {
  return webAdminApi.auth.me();
}
