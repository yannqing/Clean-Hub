import { webAdminApi } from "@/lib/api-client";

import type { ApiRequestOptions } from "@cleanhub/api-client";

import type { BranchSummary } from "../../branches/types";
import type { TenantProductCategorySummary } from "../types";
import { getProductCurrencyDatasetQuery } from "./get-product-currency-dataset.query";

const BRANCH_PAGE_SIZE = 100;

export type ProductFormDataset = {
  availableCurrencies: string[];
  branches: BranchSummary[];
  branchLoadFailed: boolean;
  categories: TenantProductCategorySummary[];
  categoryLoadFailed: boolean;
  currencyLoadFailed: boolean;
  defaultCurrency: string | null;
};

async function getAllActiveBranches(
  requestOptions: ApiRequestOptions,
): Promise<BranchSummary[]> {
  const branches: BranchSummary[] = [];
  const seenBranchIds = new Set<string>();
  let offset = 0;

  while (true) {
    const page = await webAdminApi.tenant.branches.list(
      {
        status: "active",
        limit: BRANCH_PAGE_SIZE,
        offset,
      },
      requestOptions,
    );

    const newBranches = page.filter((branch) => !seenBranchIds.has(branch.id));
    newBranches.forEach((branch) => seenBranchIds.add(branch.id));
    branches.push(...newBranches);

    if (page.length < BRANCH_PAGE_SIZE) {
      return branches;
    }

    if (newBranches.length === 0) {
      throw new Error("Branch pagination did not advance.");
    }

    offset += page.length;
  }
}

export async function getProductFormDatasetQuery(
  requestOptions: ApiRequestOptions,
): Promise<ProductFormDataset> {
  const [branchResult, categoryResult, currencyResult] = await Promise.all([
    getAllActiveBranches(requestOptions)
      .then((branches) => ({ branches, branchLoadFailed: false }))
      .catch(() => ({ branches: [], branchLoadFailed: true })),
    webAdminApi.tenant.products
      .categories(requestOptions)
      .then((response) => ({
        categories: response.data.map((category) => ({
          id: category.id,
          name: category.name,
          code: category.code,
        })),
        categoryLoadFailed: false,
      }))
      .catch(() => ({ categories: [], categoryLoadFailed: true })),
    getProductCurrencyDatasetQuery(requestOptions)
      .then((dataset) => ({
        ...dataset,
        currencyLoadFailed: false,
      }))
      .catch(() => ({
        defaultCurrency: null,
        availableCurrencies: [],
        currencyLoadFailed: true,
      })),
  ]);

  return {
    ...branchResult,
    ...categoryResult,
    ...currencyResult,
  };
}
