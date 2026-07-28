"use server";

import { revalidatePath } from "next/cache";

import { webAdminRoutes } from "@/config/routes";
import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import type { BranchFormValues, BranchSummary } from "../types";
import { validateBranchUpdateForm } from "../validators";
import { getBranchActionError } from "./branch-action-errors";

type BranchActionResult =
  | {
      ok: true;
      data: BranchSummary;
    }
  | {
      ok: false;
      errors: Partial<Record<keyof BranchFormValues, string>>;
      message: string;
      code?: string;
      status?: number;
    };

export async function updateBranchAction(
  branchId: string,
  input: BranchFormValues,
): Promise<BranchActionResult> {
  const validation = validateBranchUpdateForm(input);

  if (!validation.ok) {
    return {
      ...validation,
      message: "Check the branch form.",
    };
  }

  try {
    const branch = await webAdminApi.tenant.branches.update(
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
      ...getBranchActionError(error, "Branch could not be updated."),
    };
  }
}
