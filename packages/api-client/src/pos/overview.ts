import type { ApiClient } from "../types";
import type { PosOverview, PosOverviewQuery } from "./overview.types";

export function createPosOverviewApi(client: ApiClient) {
  return {
    get: (query?: PosOverviewQuery) =>
      client.get<PosOverview>("/pos/overview", { query }),
  };
}
