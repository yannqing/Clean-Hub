import type { ApiClient } from "../types";
import type {
  AuthContext,
  LoginRequest,
  LoginResponse,
  RefreshResponse,
} from "./types";

export function createAuthSessionApi(client: ApiClient) {
  return {
    login: (input: LoginRequest) =>
      client.post<LoginResponse>("/auth/login", input, {
        skipAuthRefresh: true,
      }),
    refresh: () =>
      client.post<RefreshResponse>("/auth/refresh", undefined, {
        skipAuthRefresh: true,
      }),
    logout: () =>
      client.post<void>("/auth/logout", undefined, {
        skipAuthRefresh: true,
        parseAs: "void",
      }),
    me: () => client.get<AuthContext>("/auth/me"),
  };
}
