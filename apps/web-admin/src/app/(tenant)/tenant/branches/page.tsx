import { BranchManagementView } from "@/features/tenant/branches/components";
import { getBranchListQuery } from "@/features/tenant/branches/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

export default async function BranchesPage() {
  const branches = await getBranchListQuery(
    {},
    await getTenantServerApiRequestOptions(),
  ).catch(() => undefined);

  return <BranchManagementView initialBranches={branches} />;
}
