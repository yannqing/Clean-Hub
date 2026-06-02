"use server";

import { webAdminApi } from "@/lib/api-client";

import type { BranchFormValues } from "../types";
import { validateBranchForm } from "../validators";

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

export async function createBranchAction(input: BranchFormValues) {
  const validation = validateBranchForm(input);

  if (!validation.ok) {
    return validation;
  }

  try {
    const branch = await webAdminApi.tenant.branches.create(validation.data);

    return {
      ok: true as const,
      data: branch,
    };
  } catch (error) {
    return getApiFailure(error);
  }
}
