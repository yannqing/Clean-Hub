import type { ApiClient } from "../types";
import { createPosBranchesApi } from "./branches";

export * from "./branches";
export * from "./branches.types";

export function createPosApi(client: ApiClient) {
  return {
    branches: createPosBranchesApi(client),
  };
}
