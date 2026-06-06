import { BranchListView } from "@/features/tenant/branches/components";
import { getBranchListQuery } from "@/features/tenant/branches/queries";
import type {
  BranchListFilters,
  BranchStatus,
} from "@/features/tenant/branches/types";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

type BranchesPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
  }>;
};

function isBranchStatus(value: string | undefined): value is BranchStatus {
  return value === "active" || value === "inactive";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Branch list failed to load.";
}

export default async function BranchesPage({
  searchParams,
}: BranchesPageProps) {
  const resolvedSearchParams = await searchParams;
  const filters: BranchListFilters = {
    q: resolvedSearchParams?.q,
    status: isBranchStatus(resolvedSearchParams?.status)
      ? resolvedSearchParams.status
      : undefined,
  };
  const result = await getBranchListQuery(
    filters,
    await getTenantServerApiRequestOptions(),
  )
    .then((branches) => ({ branches, error: undefined }))
    .catch((error: unknown) => ({
      branches: undefined,
      error: getErrorMessage(error),
    }));

  return (
    <BranchListView
      initialBranches={result.branches}
      initialError={result.error}
      initialFilters={filters}
    />
  );
}
