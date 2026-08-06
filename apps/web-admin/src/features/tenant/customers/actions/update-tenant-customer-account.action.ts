"use server";

import {
  isApiHttpError,
  type TenantCustomerAccountDetail,
  type UpdateTenantCustomerAccountRequest,
} from "@cleanhub/api-client";
import { revalidatePath } from "next/cache";

import { webAdminRoutes } from "@/config/routes";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { webAdminApi } from "@/lib/api-client";

export type UpdateTenantCustomerAccountActionResult =
  | { ok: true; data: TenantCustomerAccountDetail }
  | { ok: false; code?: string; message: string; status?: number };

export async function updateTenantCustomerAccountAction(
  accountId: string,
  input: UpdateTenantCustomerAccountRequest,
): Promise<UpdateTenantCustomerAccountActionResult> {
  try {
    const data = await webAdminApi.tenant.customers.updateAccount(
      accountId,
      input,
      await getTenantServerApiRequestOptions(),
    );
    revalidatePath(webAdminRoutes.tenant.customerAccounts);
    revalidatePath(webAdminRoutes.tenant.customerAccount(accountId));
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      code: isApiHttpError(error) ? error.code : undefined,
      message: error instanceof Error ? error.message : "Account update failed.",
      status: isApiHttpError(error) ? error.status : undefined,
    };
  }
}
