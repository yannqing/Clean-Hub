import type {
  ApiRequestOptions,
  SaasUserDirectoryDetail,
} from "@cleanhub/api-client";
import { webAdminApi } from "@/lib/api-client";

export function getUserDirectoryDetailQuery(
  userId: string,
  options: Omit<ApiRequestOptions, "method" | "body" | "query"> = {},
): Promise<SaasUserDirectoryDetail> {
  return webAdminApi.saas.users.directoryDetail(userId, options);
}
