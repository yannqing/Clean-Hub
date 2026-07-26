import { ProductCreateView } from "@/features/tenant/products/components";
import type { BranchSummary } from "@/features/tenant/branches/types";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { webAdminApi } from "@/lib/api-client";

import type { ApiRequestOptions } from "@cleanhub/api-client";

const BRANCH_PAGE_SIZE = 100;

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

export default async function NewProductPage() {
  const requestOptions = await getTenantServerApiRequestOptions();
  const [branchResult, categoryResult] = await Promise.all([
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
  ]);

  return (
    <ProductCreateView
      branches={branchResult.branches}
      branchLoadFailed={branchResult.branchLoadFailed}
      categories={categoryResult.categories}
      categoryLoadFailed={categoryResult.categoryLoadFailed}
    />
  );
}
