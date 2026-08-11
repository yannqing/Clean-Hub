import { createId } from "@cleanhub/id";

import { ServiceCreateView } from "@/features/tenant/services";
import {
  getServiceCategoryDatasetQuery,
  getServiceDefaultCurrencyQuery,
} from "@/features/tenant/services/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

export default async function NewServicePage() {
  const requestOptions = await getTenantServerApiRequestOptions();
  const [categoryResult, currencyResult] = await Promise.allSettled([
    getServiceCategoryDatasetQuery({ status: "active" }, requestOptions),
    getServiceDefaultCurrencyQuery(requestOptions),
  ]);

  return (
    <ServiceCreateView
      categories={
        categoryResult.status === "fulfilled" ? categoryResult.value : []
      }
      categoriesLoadFailed={categoryResult.status === "rejected"}
      defaultCurrency={
        currencyResult.status === "fulfilled" ? currencyResult.value : null
      }
      initialCode={`SVC-${createId().slice(-10)}`}
    />
  );
}
