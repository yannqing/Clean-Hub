"use server";

import {
  isApiHttpError,
  type ResetTenantCustomerAccountPasswordResponse,
} from "@cleanhub/api-client";

import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { webAdminApi } from "@/lib/api-client";

export type ResetTenantCustomerAccountPasswordActionResult =
  | { ok: true; data: ResetTenantCustomerAccountPasswordResponse }
  | { ok: false; code?: string; message: string; status?: number };

/**
 * Issue a customer their mobile app password.
 *
 * Deliberately does not revalidate: the generated password is the whole point
 * of the response and a refresh would discard it before staff can read it out.
 * Nothing else on the page changes.
 */
export async function resetTenantCustomerAccountPasswordAction(
  accountId: string,
): Promise<ResetTenantCustomerAccountPasswordActionResult> {
  try {
    const data = await webAdminApi.tenant.customers.resetAccountPassword(
      accountId,
      await getTenantServerApiRequestOptions(),
    );
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      code: isApiHttpError(error) ? error.code : undefined,
      message:
        error instanceof Error ? error.message : "Password reset failed.",
      status: isApiHttpError(error) ? error.status : undefined,
    };
  }
}
