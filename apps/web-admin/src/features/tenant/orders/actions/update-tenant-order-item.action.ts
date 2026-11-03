"use server";

import {
  isApiHttpError,
  type TenantOrderDetail,
  type UpdateTenantOrderItemRequest,
} from "@cleanhub/api-client";
import { revalidatePath } from "next/cache";

import { webAdminRoutes } from "@/config/routes";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { webAdminApi } from "@/lib/api-client";

export type UpdateTenantOrderItemActionResult =
  | { ok: true; data: TenantOrderDetail }
  | { ok: false; code?: string; message: string; status?: number };

export async function updateTenantOrderItemAction(
  orderId: string,
  itemId: string,
  input: UpdateTenantOrderItemRequest,
): Promise<UpdateTenantOrderItemActionResult> {
  try {
    const data = await webAdminApi.tenant.orders.updateItem(
      orderId,
      itemId,
      input,
      await getTenantServerApiRequestOptions(),
    );
    revalidatePath(webAdminRoutes.tenant.order(orderId));
    revalidatePath(webAdminRoutes.tenant.orders);
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
    return { ok: false, message: "The order item could not be updated." };
  }
}
