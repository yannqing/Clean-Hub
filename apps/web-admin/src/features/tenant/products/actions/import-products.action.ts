"use server";

import {
  isApiHttpError,
  type ImportTenantProductsRequest,
} from "@cleanhub/api-client";
import { revalidatePath } from "next/cache";
import { webAdminApi } from "@/lib/api-client";
import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import { getProductFormDatasetQuery } from "../queries/get-product-form-dataset.query";
import { getProductActionError } from "./product-action-errors";

export async function getProductImportOptionsAction() {
  const dataset = await getProductFormDatasetQuery(
    await getTenantServerApiRequestOptions(),
  );
  return {
    currency: dataset.defaultCurrency,
    unavailable: dataset.branchLoadFailed || dataset.currencyLoadFailed,
    featureDisabled: dataset.featureDisabled,
    branches: dataset.branches
      .filter((branch) => branch.defaultCurrency === dataset.defaultCurrency)
      .map((branch) => ({ id: branch.id, name: branch.name })),
  };
}

export async function importProductsAction(input: ImportTenantProductsRequest) {
  try {
    const data = await webAdminApi.tenant.products.import(
      input,
      await getTenantServerApiRequestOptions(),
    );
    revalidatePath("/tenant/products");
    return { ok: true as const, data };
  } catch (error) {
    const details = getProductActionError(
      error,
      "Products could not be imported.",
    );
    const response = isApiHttpError(error) ? error.responseData : undefined;
    const row =
      response &&
      typeof response === "object" &&
      "row" in response &&
      typeof response.row === "number"
        ? response.row
        : undefined;
    const validationIndex = isApiHttpError(error)
      ? Number(error.validationErrors?.[0]?.field.split(".")[1])
      : NaN;
    return {
      ok: false as const,
      ...details,
      row: (row ?? input.products[validationIndex]?.rowNumber) as
        | number
        | undefined,
    };
  }
}
