"use server";

import { revalidatePath } from "next/cache";

import { webAdminRoutes } from "@/config/routes";
import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import type { BranchFormValues, BranchStatus, BranchSummary } from "../types";
import { validateBranchStatusUpdate } from "../validators";
import { getBranchActionError } from "./branch-action-errors";

type BranchStatusActionResult =
  | {
      ok: true;
      data: BranchSummary;
    }
  | {
      ok: false;
      message: string;
      errors: Partial<Record<keyof BranchFormValues, string>>;
      code?: string;
      status?: number;
    };

export async function updateBranchStatusAction(
  branchId: string,
  status: BranchStatus,
  version: number,
): Promise<BranchStatusActionResult> {
  const validation = validateBranchStatusUpdate(status, version);

  if (!validation.ok) {
    return {
      ...validation,
      message: "Check the branch status request.",
    };
  }

  try {
    const branch = await webAdminApi.tenant.branches.updateStatus(
      branchId,
      validation.data,
      await getTenantServerApiRequestOptions(),
    );

    revalidatePath("/tenant");
    revalidatePath("/tenant/branches");
    revalidatePath(`/tenant/branches/${branchId}`);
    revalidatePath(webAdminRoutes.tenant.system.settingsSections.locations);
    revalidatePath(
      `${webAdminRoutes.tenant.system.settingsSections.locations}/${branchId}`,
    );

    return {
      ok: true,
      data: branch,
    };
  } catch (error) {
    return {
      ok: false,
      ...getBranchActionError(error, "Branch status could not be updated."),
    };
  }
}
