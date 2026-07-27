import "server-only";

import type { PosCatalogQuery, PosCatalogResponse } from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

export async function getPosCatalogQuery(
  query: PosCatalogQuery = {},
): Promise<PosCatalogResponse> {
  const options = await getPosServerApiRequestOptions();
  return posApi.pos.catalog.list(query, options);
}
