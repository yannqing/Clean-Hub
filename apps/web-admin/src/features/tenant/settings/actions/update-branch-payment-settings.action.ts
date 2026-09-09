"use server";

import { revalidatePath } from "next/cache";

import { isLockedPosPaymentMethod } from "@cleanhub/domain/payment-methods";

import { getAuthSessionQuery } from "@/features/auth/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { webAdminApi } from "@/lib/api-client";

import type {
  BranchCashHandlingMode,
  BranchPaymentMethod,
  BranchSummary,
} from "../../branches/types";

export type BranchPaymentSettingsInput = {
  branchId: string;
  version: number;
  paymentMethodsEnabled: BranchPaymentMethod[];
  defaultPaymentMethod: BranchPaymentMethod;
  cashHandlingMode: BranchCashHandlingMode;
};

type BranchPaymentSettingsActionResult =
  | { ok: true; data: BranchSummary }
  | { ok: false; message: string };

const PAYMENT_METHODS: readonly BranchPaymentMethod[] = ["cash", "card", "app"];
const CASH_HANDLING_MODES: readonly BranchCashHandlingMode[] = [
  "none",
  "untracked",
  "shared_drawer",
  "cash_in_hand",
];

function getErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Payment settings could not be updated.";
  }

  const source = error as Record<string, unknown>;
  if (
    source.status === 409 ||
    source.code === "BRANCH_VERSION_CONFLICT" ||
    (source.responseData &&
      typeof source.responseData === "object" &&
      (source.responseData as Record<string, unknown>).code ===
        "BRANCH_VERSION_CONFLICT")
  ) {
    return "This branch was changed elsewhere. Refresh the page and try again.";
  }

  return error instanceof Error
    ? error.message
    : "Payment settings could not be updated.";
}

export async function updateBranchPaymentSettingsAction(
  input: BranchPaymentSettingsInput,
): Promise<BranchPaymentSettingsActionResult> {
  const requestOptions = await getTenantServerApiRequestOptions();
  const authContext = await getAuthSessionQuery(requestOptions);

  if (!authContext || authContext.role !== "owner" || !authContext.tenantId) {
    return {
      ok: false,
      message: "Only tenant owners can update payment settings.",
    };
  }

  if (!input.branchId || !Number.isInteger(input.version) || input.version < 1) {
    return { ok: false, message: "Choose a valid branch and try again." };
  }

  const methods = Array.from(new Set(input.paymentMethodsEnabled));
  if (
    methods.length === 0 ||
    methods.some((method) => !PAYMENT_METHODS.includes(method))
  ) {
    return { ok: false, message: "Enable at least one payment method." };
  }

  const locked = methods.filter((method) => isLockedPosPaymentMethod(method));
  if (locked.length > 0) {
    return {
      ok: false,
      message: `${locked.join(", ")} cannot be enabled on this terminal.`,
    };
  }

  if (!methods.includes(input.defaultPaymentMethod)) {
    return {
      ok: false,
      message: "The default payment method must also be enabled.",
    };
  }

  if (!CASH_HANDLING_MODES.includes(input.cashHandlingMode)) {
    return { ok: false, message: "Choose a valid cash handling mode." };
  }

  // A branch that does not take cash cannot reconcile a drawer.
  if (!methods.includes("cash") && input.cashHandlingMode !== "none") {
    return {
      ok: false,
      message: "Enable cash before choosing how the branch handles it.",
    };
  }

  try {
    const branch = await webAdminApi.tenant.branches.update(
      input.branchId,
      {
        paymentMethodsEnabled: methods,
        defaultPaymentMethod: input.defaultPaymentMethod,
        cashHandlingMode: input.cashHandlingMode,
        version: input.version,
      },
      requestOptions,
    );

    revalidatePath("/tenant/system/settings/payments");
    revalidatePath("/tenant/system/settings/cash");
    revalidatePath(`/tenant/branches/${input.branchId}`);
    revalidatePath("/tenant", "layout");

    return { ok: true, data: branch };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}
