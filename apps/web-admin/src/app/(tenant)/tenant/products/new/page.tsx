import { ProductCreateView } from "@/features/tenant/products/components";
import { getProductFormDatasetQuery } from "@/features/tenant/products/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

export default async function NewProductPage() {
  const requestOptions = await getTenantServerApiRequestOptions();
  const dataset = await getProductFormDatasetQuery(requestOptions);

  return (
    <ProductCreateView
      availableCurrencies={dataset.availableCurrencies}
      branches={dataset.branches}
      branchLoadFailed={dataset.branchLoadFailed}
      categories={dataset.categories}
      categoryLoadFailed={dataset.categoryLoadFailed}
      currencyLoadFailed={dataset.currencyLoadFailed}
      defaultCurrency={dataset.defaultCurrency}
    />
  );
}
