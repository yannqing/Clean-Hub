"use server";

import {
  isApiHttpError,
  type CreateTenantCustomerCommentRequest,
  type TenantCustomerTimelineItem,
} from "@cleanhub/api-client";
import { revalidatePath } from "next/cache";

import { webAdminRoutes } from "@/config/routes";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { webAdminApi } from "@/lib/api-client";

export async function createTenantCustomerCommentAction(
  customerId: string,
  input: CreateTenantCustomerCommentRequest,
): Promise<
  | { ok: true; data: TenantCustomerTimelineItem }
  | { ok: false; message: string }
> {
  try {
    const data = await webAdminApi.tenant.customers.createComment(
      customerId,
      input,
      await getTenantServerApiRequestOptions(),
    );
    revalidatePath(webAdminRoutes.tenant.customer(customerId));
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      message: isApiHttpError(error)
        ? error.message
        : "The comment could not be posted.",
    };
  }
}
