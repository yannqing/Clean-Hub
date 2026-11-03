import type {
  MobilePasswordLoginRequest,
  MobileRequestOtpRequest,
  MobileVerifyOtpRequest,
} from "@cleanhub/api-client";

import { apiClient } from "@/lib/api-client";
import { getOrCreateDeviceId } from "@/lib/token-storage";

import { persistLoginResponse } from "./session.actions";

type TenantScopedInput = {
  tenantCode: string;
};

export async function requestCustomerOtp(input: TenantScopedInput & { phone: string }) {
  const payload: MobileRequestOtpRequest = {
    tenantCode: input.tenantCode,
    phone: input.phone.trim(),
    deviceId: await getOrCreateDeviceId(),
  };

  return apiClient.mobile.auth.requestCustomerOtp(payload);
}

export async function getCustomerTestOtp(input: TenantScopedInput & { phone: string }) {
  return apiClient.mobile.auth.getCustomerTestOtp({
    tenantCode: input.tenantCode,
    phone: input.phone.trim(),
  });
}

export async function verifyCustomerOtp(input: TenantScopedInput & { phone: string; code: string }) {
  const payload: MobileVerifyOtpRequest = {
    tenantCode: input.tenantCode,
    phone: input.phone.trim(),
    code: input.code.trim(),
    deviceId: await getOrCreateDeviceId(),
  };

  const response = await apiClient.mobile.auth.verifyCustomerOtp(payload);
  return persistLoginResponse(response);
}

export async function loginCustomerWithPassword(
  input: TenantScopedInput & { identifier: string; password: string },
) {
  const response = await apiClient.mobile.auth.loginCustomerWithPassword(
    await createPasswordPayload(input),
  );
  return persistLoginResponse(response);
}

export async function loginDriver(input: TenantScopedInput & { identifier: string; password: string }) {
  const response = await apiClient.mobile.auth.loginDriver(await createPasswordPayload(input));
  return persistLoginResponse(response);
}

export async function loginOwner(input: TenantScopedInput & { identifier: string; password: string }) {
  const response = await apiClient.mobile.auth.loginOwner(await createPasswordPayload(input));
  return persistLoginResponse(response);
}

async function createPasswordPayload(
  input: TenantScopedInput & { identifier: string; password: string },
): Promise<MobilePasswordLoginRequest> {
  return {
    tenantCode: input.tenantCode,
    identifier: input.identifier.trim(),
    password: input.password,
    deviceId: await getOrCreateDeviceId(),
  };
}
