import type { ApiClient } from "../../types";
import type { SaasOverview } from "./overview.types";

export function createSaasOverviewApi(client: ApiClient) {
  return {
    get: () => client.get<SaasOverview>("/saas/overview"),
  };
}
