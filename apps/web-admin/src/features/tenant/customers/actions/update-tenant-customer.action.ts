"use server";

import {
  isApiHttpError,
  type TenantCustomerDetail,
  type UpdateTenantCustomerRequest,
} from "@cleanhub/api-client";
import { revalidatePath } from "next/cache";

import { webAdminRoutes } from "@/config/routes";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { webAdminApi } from "@/lib/api-client";

export type UpdateTenantCustomerActionResult =
  | { ok: true; data: TenantCustomerDetail }
  | { ok: false; code?: string; message: string; status?: number };

export async function updateTenantCustomerAction(
  customerId: string,
  input: UpdateTenantCustomerRequest,
): Promise<UpdateTenantCustomerActionResult> {
  try {
    const data = await webAdminApi.tenant.customers.update(
      customerId,
      input,
      await getTenantServerApiRequestOptions(),
    );
    revalidatePath(webAdminRoutes.tenant.customers);
    revalidatePath(webAdminRoutes.tenant.customer(customerId));
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      code: isApiHttpError(error) ? error.code : undefined,
      message: error instanceof Error ? error.message : "Customer update failed.",
      status: isApiHttpError(error) ? error.status : undefined,
    };
  }
}
