import { createId } from "@cleanhub/id";

import { ServiceCreateView } from "@/features/tenant/services";
import { getBranchListQuery } from "@/features/tenant/branches/queries";
import {
  getServiceCategoryDatasetQuery,
  getServiceDefaultCurrencyQuery,
} from "@/features/tenant/services/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { getTaxRateOptionsQuery } from "@/features/tenant/tax-rates/queries";

export default async function NewServicePage() {
  const requestOptions = await getTenantServerApiRequestOptions();
  const [categoryResult, currencyResult, branchResult] =
    await Promise.allSettled([
      getServiceCategoryDatasetQuery({ status: "active" }, requestOptions),
      getServiceDefaultCurrencyQuery(requestOptions),
      getBranchListQuery({}, requestOptions),
    ]);
  const taxRateOptions = await getTaxRateOptionsQuery(requestOptions);

  return (
    <ServiceCreateView
      categories={
        categoryResult.status === "fulfilled" ? categoryResult.value : []
      }
      categoriesLoadFailed={categoryResult.status === "rejected"}
      branches={branchResult.status === "fulfilled" ? branchResult.value : []}
      branchesLoadFailed={branchResult.status === "rejected"}
      defaultCurrency={
        currencyResult.status === "fulfilled" ? currencyResult.value : null
      }
      initialCode={`SVC-${createId().slice(-10)}`}
      taxRateOptions={taxRateOptions}
    />
  );
}
