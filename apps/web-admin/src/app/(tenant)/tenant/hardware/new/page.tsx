import { HardwareFormView } from "@/features/tenant/hardware/components";
import { getBranchListQuery } from "@/features/tenant/branches/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

export default async function NewHardwarePage() {
  const requestOptions = await getTenantServerApiRequestOptions();
  const branchResult = await getBranchListQuery({}, requestOptions).then(
    (branches) => ({ branches, branchLoadFailed: false }),
    () => ({ branches: [], branchLoadFailed: true }),
  );

  return (
    <HardwareFormView
      branches={branchResult.branches}
      branchLoadFailed={branchResult.branchLoadFailed}
    />
  );
}
