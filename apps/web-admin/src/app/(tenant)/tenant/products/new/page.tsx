import { ProductCreateView } from "@/features/tenant/products/components";
import { ProductAccessNotice } from "@/features/tenant/products/components/product-access-notice";
import { getProductAccessQuery } from "@/features/tenant/products/queries/get-product-access.query";
import { getProductFormDatasetQuery } from "@/features/tenant/products/queries/get-product-form-dataset.query";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

export default async function NewProductPage() {
  const requestOptions = await getTenantServerApiRequestOptions();
  const access = await getProductAccessQuery(requestOptions);
  if (access !== "enabled") {
    return <ProductAccessNotice access={access} />;
  }

  const dataset = await getProductFormDatasetQuery(requestOptions);
  if (dataset.featureDisabled) {
    return <ProductAccessNotice />;
  }

  return (
    <ProductCreateView
      availableCurrencies={dataset.availableCurrencies}
      branches={dataset.branches}
      branchLoadFailed={dataset.branchLoadFailed}
      categories={dataset.categories}
      categoryLoadFailed={dataset.categoryLoadFailed}
      currencyLoadFailed={dataset.currencyLoadFailed}
      defaultCurrency={dataset.defaultCurrency}
      taxRateOptions={dataset.taxRateOptions}
    />
  );
}
