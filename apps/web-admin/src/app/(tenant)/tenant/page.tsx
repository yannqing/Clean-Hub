import {
  BRANCH_LIST_LIMIT,
  getBranchListQuery,
} from "@/features/tenant/branches/queries";
import { TenantOverviewView } from "@/features/tenant/overview/components";
import { getTenantOverviewQuery } from "@/features/tenant/overview/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

export default async function TenantHomePage() {
  const requestOptions = await getTenantServerApiRequestOptions();
  const [overview, branches] = await Promise.all([
    getTenantOverviewQuery(requestOptions).catch(() => undefined),
    getBranchListQuery({}, requestOptions).catch(() => undefined),
  ]);

  return (
    <TenantOverviewView
      initialBranchCount={branches?.length}
      initialBranchCountReachedLimit={branches?.length === BRANCH_LIST_LIMIT}
      initialOverview={overview}
    />
  );
}
