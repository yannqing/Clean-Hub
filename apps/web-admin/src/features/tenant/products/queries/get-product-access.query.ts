import "server-only";

import type { ApiRequestOptions } from "@cleanhub/api-client";

import { getTenantSettingsQuery } from "../../settings/queries";
import type { ProductAccessState } from "../product-access";

export async function getProductAccessQuery(
  requestOptions: ApiRequestOptions,
): Promise<ProductAccessState> {
  try {
    const settings = await getTenantSettingsQuery(requestOptions);
    return settings.featureFlags.retailProductsEnabled ? "enabled" : "disabled";
  } catch {
    // Do not offer product actions until the current tenant's access is known.
    return "unavailable";
  }
}
