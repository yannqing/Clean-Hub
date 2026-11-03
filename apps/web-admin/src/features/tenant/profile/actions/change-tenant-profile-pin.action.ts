"use server";

import { isApiHttpError } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";

export async function changeTenantProfilePinAction(input: { currentPin: string; newPin: string }): Promise<
  { ok: true } | { ok: false; code: string }
> {
  try {
    await webAdminApi.tenant.profile.changePin(input, await getTenantServerApiRequestOptions());
    return { ok: true };
  } catch (error) {
    return { ok: false, code: isApiHttpError(error) ? error.code ?? "UNKNOWN" : "UNKNOWN" };
  }
}
