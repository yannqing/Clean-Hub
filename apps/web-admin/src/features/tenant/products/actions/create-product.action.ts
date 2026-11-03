"use server";

import { revalidatePath } from "next/cache";

import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import type {
  CreateTenantProductResponse,
  ProductFormErrors,
  ProductFormValues,
} from "../types";
import { validateProductForm } from "../validators";
import { getProductActionError } from "./product-action-errors";

export type CreateProductActionResult =
  | {
      ok: true;
      data: CreateTenantProductResponse;
    }
  | {
      ok: false;
      errors: ProductFormErrors;
      message: string;
      code?: string;
      status?: number;
      invalidCategoryAttributeDefinitionIds?: string[];
    };

export async function createProductAction(
  input: ProductFormValues,
): Promise<CreateProductActionResult> {
  const validation = validateProductForm(input);

  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      invalidCategoryAttributeDefinitionIds:
        validation.invalidCategoryAttributeDefinitionIds,
      message: "Check the product form.",
    };
  }

  try {
    const { currency: _tenantManagedCurrency, ...productInput } =
      validation.data;
    void _tenantManagedCurrency;
    const product = await webAdminApi.tenant.products.create(
      productInput,
      await getTenantServerApiRequestOptions(),
    );

    revalidatePath("/tenant/products");

    return {
      ok: true,
      data: product,
    };
  } catch (error) {
    return {
      ok: false,
      ...getProductActionError(error, "Product could not be created."),
    };
  }
}
