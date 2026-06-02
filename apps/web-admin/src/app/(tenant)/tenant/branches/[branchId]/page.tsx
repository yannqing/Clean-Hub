import { PagePlaceholder } from "@/components/app-shell";
import { BranchDetailView } from "@/features/tenant/branches/components";
import { getBranchDetailQuery } from "@/features/tenant/branches/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

type BranchDetailPageProps = {
  params: Promise<{
    branchId: string;
  }>;
};

export default async function BranchDetailPage({
  params,
}: BranchDetailPageProps) {
  const { branchId } = await params;
  const branch = await getBranchDetailQuery(
    branchId,
    await getTenantServerApiRequestOptions(),
  ).catch(() => undefined);

  if (branch) {
    return <BranchDetailView initialBranch={branch} />;
  }

  return (
    <PagePlaceholder
      description={`Branch ${branchId} could not be loaded. It may be outside the current user's branch scope or unavailable.`}
      items={["Check API route mounting", "Check branch scope", "Retry from list"]}
      title="Branch unavailable"
    />
  );
}
