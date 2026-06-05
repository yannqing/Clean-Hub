import { PagePlaceholder } from "@/components/app-shell";
import { BranchDetailView } from "@/features/tenant/branches/components";
import { getBranchDetailQuery } from "@/features/tenant/branches/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

type BranchDetailPageProps = {
  params: Promise<{
    branchId: string;
  }>;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Branch detail failed to load.";
}

export default async function BranchDetailPage({
  params,
}: BranchDetailPageProps) {
  const { branchId } = await params;
  const result = await getBranchDetailQuery(
    branchId,
    await getTenantServerApiRequestOptions(),
  )
    .then((branch) => ({ branch, error: undefined }))
    .catch((error: unknown) => ({
      branch: undefined,
      error: getErrorMessage(error),
    }));

  if (result.branch) {
    return <BranchDetailView initialBranch={result.branch} />;
  }

  return (
    <PagePlaceholder
      description={
        result.error ??
        `Branch ${branchId} could not be loaded. It may be outside the current user's branch scope or unavailable.`
      }
      items={["Check API route mounting", "Check branch scope", "Retry from list"]}
      title="Branch unavailable"
    />
  );
}
