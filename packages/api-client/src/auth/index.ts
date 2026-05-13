import type { ApiClient } from "../types";
import { createAuthSessionApi } from "./session";

export * from "./session";
export * from "./types";

export function createAuthApi(client: ApiClient) {
  return createAuthSessionApi(client);
}
