import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  MobileAuthContext,
  MobileCustomerLoginOptions,
  MobileLogoutRequest,
  MobilePasswordLoginRequest,
  MobileRefreshRequest,
  MobileRequestOtpRequest,
  MobileTestOtpResponse,
  MobileTokenResponse,
  MobileVerifyOtpRequest,
} from "./auth.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createMobileAuthApi(client: ApiClient) {
  return {
    getCustomerLoginOptions: (
      query: Pick<MobileRequestOtpRequest, "tenantCode">,
      options?: RequestOptions,
    ) =>
      client.get<MobileCustomerLoginOptions>("/mobile/auth/customer/login-options", {
        ...options,
        query,
      }),
    requestCustomerOtp: (
      input: MobileRequestOtpRequest,
      options?: RequestOptions,
    ) =>
      client.post<MobileTestOtpResponse>(
        "/mobile/auth/customer/otp/request",
        input,
        options,
      ),
    getCustomerTestOtp: (
      query: Pick<MobileRequestOtpRequest, "tenantCode" | "phone">,
      options?: RequestOptions,
    ) =>
      client.get<MobileTestOtpResponse>("/mobile/auth/customer/otp/test", {
        ...options,
        query,
      }),
    verifyCustomerOtp: (
      input: MobileVerifyOtpRequest,
      options?: RequestOptions,
    ) =>
      client.post<MobileTokenResponse>(
        "/mobile/auth/customer/otp/verify",
        input,
        options,
      ),
    loginCustomerWithPassword: (
      input: MobilePasswordLoginRequest,
      options?: RequestOptions,
    ) =>
      client.post<MobileTokenResponse>(
        "/mobile/auth/customer/password",
        input,
        options,
      ),
    loginDriver: (input: MobilePasswordLoginRequest, options?: RequestOptions) =>
      client.post<MobileTokenResponse>(
        "/mobile/auth/staff/driver/login",
        input,
        options,
      ),
    loginOwner: (input: MobilePasswordLoginRequest, options?: RequestOptions) =>
      client.post<MobileTokenResponse>(
        "/mobile/auth/staff/owner/login",
        input,
        options,
      ),
    refresh: (input: MobileRefreshRequest, options?: RequestOptions) =>
      client.post<MobileTokenResponse>("/mobile/auth/refresh", input, options),
    logout: (input: MobileLogoutRequest, options?: RequestOptions) =>
      client.post<void>("/mobile/auth/logout", input, {
        ...options,
        parseAs: "void",
      }),
    me: (options?: RequestOptions) =>
      client.get<MobileAuthContext>("/mobile/auth/me", options),
  };
}
