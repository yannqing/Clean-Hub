"use server";

import { revalidatePath } from "next/cache";

import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import type { BranchFormValues, BranchSummary } from "../types";
import { validateBranchForm } from "../validators";
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

export async function createBranchAction(
  input: BranchFormValues,
): Promise<BranchActionResult> {
  const validation = validateBranchForm(input);

  if (!validation.ok) {
    return {
      ...validation,
      message: "Check the branch form.",
    };
  }

  try {
    const branch = await webAdminApi.tenant.branches.create(
      validation.data,
      await getTenantServerApiRequestOptions(),
    );

    revalidatePath("/tenant");
    revalidatePath("/tenant/branches");

    return {
      ok: true,
      data: branch,
    };
  } catch (error) {
    return {
      ok: false,
      ...getBranchActionError(error, "Branch could not be created."),
    };
  }
}
