import { createAuthApi } from "./auth";
import { createApiClient } from "./http-client";
import { createMobileApi } from "./mobile";
import { createPosApi } from "./pos";
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
    pos: createPosApi(http),
    mobile: createMobileApi(http),
  };
}

export type CleanHubApiClient = ReturnType<typeof createCleanHubApiClient>;
