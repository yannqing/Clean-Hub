"use server";

import { revalidatePath } from "next/cache";

import {
  POS_RECEIPT_FIELDS,
  POS_TICKET_LABEL_FIELDS,
  REQUIRED_POS_RECEIPT_FIELDS,
  REQUIRED_POS_TICKET_LABEL_FIELDS,
  type PosReceiptField,
  type PosTicketLabelField,
} from "@cleanhub/domain/receipt";

import { getAuthSessionQuery } from "@/features/auth/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { webAdminApi } from "@/lib/api-client";

import type { BranchSummary } from "../../branches/types";

export type BranchPrintingSettingsInput = {
  branchId: string;
  version: number;
  receiptName: string;
  receiptPhone: string;
  receiptAddress: string;
  receiptThankYouMessage: string;
  receiptFields: PosReceiptField[];
  ticketLabelFields: PosTicketLabelField[];
};

type BranchPrintingSettingsActionResult =
  | { ok: true; data: BranchSummary }
  | { ok: false; message: string };

function isValidFieldSelection<TField extends string>(
  selected: readonly TField[],
  available: readonly TField[],
  required: readonly TField[],
): boolean {
  return (
    selected.length > 0 &&
    selected.every((field) => available.includes(field)) &&
    required.every((field) => selected.includes(field))
  );
}

function getErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Printing settings could not be updated.";
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
    : "Printing settings could not be updated.";
}

export async function updateBranchPrintingSettingsAction(
  input: BranchPrintingSettingsInput,
): Promise<BranchPrintingSettingsActionResult> {
  const requestOptions = await getTenantServerApiRequestOptions();
  const authContext = await getAuthSessionQuery(requestOptions);

  if (!authContext || authContext.role !== "owner" || !authContext.tenantId) {
    return {
      ok: false,
      message: "Only tenant owners can update printing settings.",
    };
  }

  if (
    !input.branchId ||
    !Number.isInteger(input.version) ||
    input.version < 1
  ) {
    return { ok: false, message: "Choose a valid branch and try again." };
  }

  if (
    input.receiptName.trim().length > 200 ||
    input.receiptPhone.trim().length > 32 ||
    input.receiptAddress.trim().length > 500 ||
    input.receiptThankYouMessage.trim().length > 500
  ) {
    return { ok: false, message: "Check the receipt contact information." };
  }

  if (
    !isValidFieldSelection(
      input.receiptFields,
      POS_RECEIPT_FIELDS,
      REQUIRED_POS_RECEIPT_FIELDS,
    ) ||
    !isValidFieldSelection(
      input.ticketLabelFields,
      POS_TICKET_LABEL_FIELDS,
      REQUIRED_POS_TICKET_LABEL_FIELDS,
    )
  ) {
    return { ok: false, message: "Choose valid required printing fields." };
  }

  try {
    const branch = await webAdminApi.tenant.branches.update(
      input.branchId,
      {
        receiptName: input.receiptName.trim() || null,
        receiptPhone: input.receiptPhone.trim() || null,
        receiptAddress: input.receiptAddress.trim() || null,
        receiptThankYouMessage: input.receiptThankYouMessage.trim() || null,
        receiptFields: Array.from(new Set(input.receiptFields)),
        ticketLabelFields: Array.from(new Set(input.ticketLabelFields)),
        version: input.version,
      },
      requestOptions,
    );

    revalidatePath("/tenant/system/settings/printing");
    revalidatePath(`/tenant/branches/${input.branchId}`);
    revalidatePath("/tenant", "layout");

    return { ok: true, data: branch };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}
