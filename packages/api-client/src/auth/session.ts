import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  AuthContext,
  AuthPosPinLoginRequest,
  LoginRequest,
  LoginResponse,
  PosBootstrapRequest,
  PosBootstrapResponse,
  RefreshResponse,
} from "./types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createAuthSessionApi(client: ApiClient) {
  return {
    login: (input: LoginRequest, options: RequestOptions = {}) =>
      client.post<LoginResponse>("/auth/login", input, {
        skipAuthRefresh: true,
        ...options,
      }),
    posPinLogin: (input: AuthPosPinLoginRequest, options: RequestOptions = {}) =>
      client.post<LoginResponse>("/auth/pos-pin-login", input, {
        skipAuthRefresh: true,
        ...options,
      }),
    posBootstrap: (
      input: PosBootstrapRequest,
      options: RequestOptions = {},
    ) =>
      client.post<PosBootstrapResponse>("/auth/pos-bootstrap", input, {
        skipAuthRefresh: true,
        ...options,
      }),
    refresh: (options: RequestOptions = {}) =>
      client.post<RefreshResponse>("/auth/refresh", undefined, {
        skipAuthRefresh: true,
        ...options,
      }),
    logout: (options: RequestOptions = {}) =>
      client.post<void>("/auth/logout", undefined, {
        skipAuthRefresh: true,
        parseAs: "void",
        ...options,
      }),
    me: (options: RequestOptions = {}) => client.get<AuthContext>("/auth/me", options),
  };
}
