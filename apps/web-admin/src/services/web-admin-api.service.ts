import { apiClient } from "@/lib/api-client";

export function getWebAdminApi() {
  return {
    get: <TResponse>(path: string) => apiClient<TResponse>(path),
  };
}
