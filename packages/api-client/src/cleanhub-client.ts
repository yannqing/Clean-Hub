import { createAuthApi } from "./auth";
import { createApiClient } from "./http-client";
import { createSaasApi } from "./saas";
import { createTenantApi } from "./tenant";
import type { ApiClientConfig } from "./types";

export function createCleanHubApiClient(config: ApiClientConfig) {
  const http = createApiClient(config);

  return {
    http,
    auth: createAuthApi(http),
    saas: createSaasApi(http),
    tenant: createTenantApi(http),
  };
}

export type CleanHubApiClient = ReturnType<typeof createCleanHubApiClient>;
