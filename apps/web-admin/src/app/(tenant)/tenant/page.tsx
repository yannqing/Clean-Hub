import { TenantOverviewView } from "@/features/tenant/overview/components";
import { getTenantOverviewQuery } from "@/features/tenant/overview/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

export default async function TenantHomePage() {
  const overview = await getTenantOverviewQuery(
    await getTenantServerApiRequestOptions(),
  ).catch(() => undefined);

  return <TenantOverviewView initialOverview={overview} />;
}
