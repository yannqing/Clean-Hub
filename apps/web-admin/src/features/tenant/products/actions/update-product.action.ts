"use server";

import { revalidatePath } from "next/cache";

import { getAuthSessionQuery } from "@/features/auth/queries";
import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import type {
  ProductFormErrors,
  ProductFormValues,
  UpdateTenantProductResponse,
} from "../types";
import { validateProductForm } from "../validators";
import { getProductActionError } from "./product-action-errors";

export type UpdateProductActionResult =
  | {
      ok: true;
      data: UpdateTenantProductResponse;
    }
  | {
      ok: false;
      errors: ProductFormErrors;
      message: string;
      code?: string;
      status?: number;
      invalidCategoryAttributeDefinitionIds?: string[];
    };

export async function updateProductAction(
  productId: string,
  version: number,
  skuId: string,
  skuVersion: number,
  input: ProductFormValues,
  retainedMediaIds: string[],
  expectedStockOnHandByBranchId: Record<string, string>,
): Promise<UpdateProductActionResult> {
  const requestOptions = await getTenantServerApiRequestOptions();
  const authContext = await getAuthSessionQuery(requestOptions);

  if (authContext?.role !== "owner") {
    return {
      ok: false,
      errors: {},
      message: "Only tenant owners can update product master data.",
      code: "PRODUCT_UPDATE_FORBIDDEN",
      status: 403,
    };
  }

  const validation = validateProductForm(input, "edit");

  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      invalidCategoryAttributeDefinitionIds:
        validation.invalidCategoryAttributeDefinitionIds,
      message: "Check the product form.",
    };
  }

  const {
    branchSettings,
    mediaObjectKeys: newMediaObjectKeys,
    ...product
  } = validation.data;

  try {
    const updatedProduct = await webAdminApi.tenant.products.update(
      productId,
      {
        ...product,
        version,
        skuId,
        skuVersion,
        retainedMediaIds,
        newMediaObjectKeys,
        branchSettings: branchSettings.map(
          ({ branchId, openingStock, reorderPoint }) => ({
            branchId,
            expectedStockOnHand: expectedStockOnHandByBranchId[branchId] ?? "0",
            stockOnHand: openingStock,
            reorderPoint,
          }),
        ),
      },
      requestOptions,
    );

    revalidatePath("/tenant/products");
    revalidatePath(`/tenant/products/${encodeURIComponent(productId)}`);

    return {
      ok: true,
      data: updatedProduct,
    };
  } catch (error) {
    return {
      ok: false,
      ...getProductActionError(error, "Product could not be updated."),
    };
  }
}
