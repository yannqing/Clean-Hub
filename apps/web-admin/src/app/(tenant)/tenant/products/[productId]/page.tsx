import { isApiHttpError } from "@cleanhub/api-client";
import { notFound } from "next/navigation";

import { getAuthSessionQuery } from "@/features/auth/queries";
import { ProductCreateView } from "@/features/tenant/products/components";
import {
  getProductDetailQuery,
  getProductFormDatasetQuery,
} from "@/features/tenant/products/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

type EditProductPageProps = {
  params: Promise<{
    productId: string;
  }>;
};

async function loadEditProductPageData(
  productId: string,
  requestOptions: Awaited<ReturnType<typeof getTenantServerApiRequestOptions>>,
) {
  try {
    return await Promise.all([
      getProductDetailQuery(productId, requestOptions),
      getProductFormDatasetQuery(requestOptions),
    ]);
  } catch (error) {
    if (
      isApiHttpError(error) &&
      (error.status === 403 || error.status === 404)
    ) {
      notFound();
    }

    throw error;
  }
}

export default async function EditProductPage({
  params,
}: EditProductPageProps) {
  const { productId } = await params;

  if (!ULID_PATTERN.test(productId)) {
    notFound();
  }

  const requestOptions = await getTenantServerApiRequestOptions();
  const authContext = await getAuthSessionQuery(requestOptions);

  if (authContext?.role !== "owner") {
    notFound();
  }

  const [initialProduct, dataset] = await loadEditProductPageData(
    productId,
    requestOptions,
  );
  const availableCurrencies = dataset.availableCurrencies.includes(
    initialProduct.currency,
  )
    ? dataset.availableCurrencies
    : [initialProduct.currency, ...dataset.availableCurrencies];

  return (
    <ProductCreateView
      availableCurrencies={availableCurrencies}
      branches={dataset.branches}
      branchLoadFailed={dataset.branchLoadFailed}
      categories={dataset.categories}
      categoryLoadFailed={dataset.categoryLoadFailed}
      currencyLoadFailed={dataset.currencyLoadFailed}
      defaultCurrency={dataset.defaultCurrency}
      taxRateOptions={dataset.taxRateOptions}
      initialProduct={initialProduct}
      mode="edit"
    />
  );
}
