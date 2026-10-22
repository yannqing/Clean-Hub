import type {
  RequestTenantServiceMediaDownloads,
  TenantServiceMediaDownloadListResponse,
} from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

export async function getServiceMediaDownloadsQuery(
  input: RequestTenantServiceMediaDownloads,
  signal?: AbortSignal,
): Promise<TenantServiceMediaDownloadListResponse> {
  return webAdminApi.tenant.services.requestMediaDownloads(input, { signal });
}
