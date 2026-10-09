import type {
  RequestTenantProductMediaDownloads,
  TenantProductMediaDownloadListResponse,
} from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

export async function getTenantProductMediaDownloadsQuery(
  input: RequestTenantProductMediaDownloads,
  signal?: AbortSignal,
): Promise<TenantProductMediaDownloadListResponse> {
  return webAdminApi.tenant.products.requestMediaDownloads(input, { signal });
}
