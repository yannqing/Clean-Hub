import type { ApiClient } from "../types";
import { createPosBranchesApi } from "./branches";
import type { PosBranchSummary } from "./branches.types";

export * from "./branches";
export * from "./branches.types";

export function createPosApi(client: ApiClient) {
  const branches = createPosBranchesApi(client);

  return {
    branches,
    getMyBranch: (options?: Parameters<typeof branches.getMine>[0]) =>
      branches.getMine(options),
  };
}

export type { PosBranchSummary };
