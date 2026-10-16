import { Badge, Button } from "@cleanhub/ui";
import Link from "next/link";

import { webAdminRoutes } from "@/config/routes";
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
    <section className="grid gap-5 p-5">
      <div className="rounded-md border bg-background p-5">
        <Badge variant="secondary">Branch unavailable</Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal">
          Branch could not be loaded
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {result.error ??
            `Branch ${branchId} may be outside the current user's branch scope or unavailable.`}
        </p>
        <Button asChild className="mt-5" type="button" variant="outline">
          <Link href={webAdminRoutes.tenant.branches}>Back to branches</Link>
        </Button>
      </div>
    </section>
  );
}
