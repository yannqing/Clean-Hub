"use server";

import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import type { BranchStatus, BranchSummary } from "../types";

type BranchStatusActionResult =
  | {
      ok: true;
      data: BranchSummary;
    }
  | {
      ok: false;
      message: string;
    };

function getActionErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Branch status could not be updated.";
}

export async function updateBranchStatusAction(
  branchId: string,
  status: BranchStatus,
  version?: number,
): Promise<BranchStatusActionResult> {
  try {
    const branch = await webAdminApi.tenant.branches.updateStatus(
      branchId,
      { status, version },
      await getTenantServerApiRequestOptions(),
    );

    return {
      ok: true,
      data: branch,
    };
  } catch (error) {
    return {
      ok: false,
      message: getActionErrorMessage(error),
    };
  }
}
