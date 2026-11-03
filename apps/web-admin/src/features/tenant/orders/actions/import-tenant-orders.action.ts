"use server";

import {
  isApiHttpError,
  type TenantOrderImportRequest,
  type TenantOrderImportResponse,
} from "@cleanhub/api-client";
import { revalidatePath } from "next/cache";

import { webAdminRoutes } from "@/config/routes";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { webAdminApi } from "@/lib/api-client";

export type ImportTenantOrdersActionResult =
  | { ok: true; data: TenantOrderImportResponse }
  | { ok: false; code?: string; message: string; status?: number };

export async function importTenantOrdersAction(
  input: TenantOrderImportRequest,
): Promise<ImportTenantOrdersActionResult> {
  try {
    const data = await webAdminApi.tenant.orders.importOrders(
      input,
      await getTenantServerApiRequestOptions(),
    );

    if (data.imported > 0) {
      revalidatePath(webAdminRoutes.tenant.orders);
    }

    return { ok: true, data };
  } catch (error) {
    if (isApiHttpError(error)) {
      return {
        ok: false,
        code: error.code,
        message: error.message,
        status: error.status,
      };
    }

    return {
      ok: false,
      message: "Orders could not be imported.",
    };
  }
}
