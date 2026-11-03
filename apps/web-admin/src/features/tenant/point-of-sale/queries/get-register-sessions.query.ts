import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import type {
  PointOfSaleRegisterSessionList,
  PointOfSaleRegisterSessionQuery,
} from "../types";

export async function getRegisterSessionsQuery(
  query?: PointOfSaleRegisterSessionQuery,
): Promise<PointOfSaleRegisterSessionList> {
  return webAdminApi.tenant.posChannel.listRegisterSessions(
    query,
    await getTenantServerApiRequestOptions(),
  );
}
