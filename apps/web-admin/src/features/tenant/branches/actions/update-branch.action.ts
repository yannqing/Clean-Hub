"use server";

import { webAdminApi } from "@/lib/api-client";

import type { BranchFormValues, BranchStatus } from "../types";
import { validateBranchUpdateForm } from "../validators";

function getApiFailure(error: unknown) {
  const status =
    typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : undefined;
  const code =
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : undefined;

  return {
    ok: false as const,
    message: error instanceof Error ? error.message : "Branch request failed.",
    status,
    code,
  };
}

export async function updateBranchAction(
  branchId: string,
  input: BranchFormValues,
) {
  const validation = validateBranchUpdateForm(input);

  if (!validation.ok) {
    return validation;
  }

  try {
    const branch = await webAdminApi.tenant.branches.update(
      branchId,
      validation.data,
    );

    return {
      ok: true as const,
      data: branch,
    };
  } catch (error) {
    return getApiFailure(error);
  }
}

export async function updateBranchStatusAction(
  branchId: string,
  status: BranchStatus,
  version: number,
) {
  try {
    const branch = await webAdminApi.tenant.branches.updateStatus(branchId, {
      status,
      version,
    });

    return {
      ok: true as const,
      data: branch,
    };
  } catch (error) {
    return getApiFailure(error);
  }
}
