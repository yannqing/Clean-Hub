"use server";

import { revalidatePath } from "next/cache";

import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import type { BranchFormValues, BranchStatus, BranchSummary } from "../types";
import { validateBranchUpdateForm } from "../validators";

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

function getActionError(error: unknown) {
  const status =
    typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : undefined;
  const code =
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : undefined;

  return {
    message:
      error instanceof Error ? error.message : "Branch could not be updated.",
    code,
    status,
  };
}

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

    return {
      ok: true,
      data: branch,
    };
  } catch (error) {
    return {
      ok: false,
      errors: {},
      ...getActionError(error),
    };
  }
}

export async function updateBranchStatusAction(
  branchId: string,
  status: BranchStatus,
  version: number,
): Promise<BranchActionResult> {
  try {
    const branch = await webAdminApi.tenant.branches.updateStatus(
      branchId,
      { status, version },
      await getTenantServerApiRequestOptions(),
    );

    revalidatePath("/tenant");
    revalidatePath("/tenant/branches");
    revalidatePath(`/tenant/branches/${branchId}`);

    return {
      ok: true,
      data: branch,
    };
  } catch (error) {
    return {
      ok: false,
      errors: {},
      ...getActionError(error),
    };
  }
}
