import { webAdminApi } from "@/lib/api-client";

import type {
  ApiRequestOptions,
  TenantProductDetail,
} from "@cleanhub/api-client";

type ProductDetailRequestOptions = Omit<
  ApiRequestOptions,
  "method" | "body" | "query"
>;

export async function getProductDetailQuery(
  productId: string,
  options: ProductDetailRequestOptions = {},
): Promise<TenantProductDetail> {
  return webAdminApi.tenant.products.get(productId, options);
}
