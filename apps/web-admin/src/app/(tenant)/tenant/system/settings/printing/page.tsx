import { BranchPrintingSettingsView } from "@/features/tenant/settings/components";
import { getBranchListQuery } from "@/features/tenant/branches/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Printing settings failed to load.";
}

export default async function TenantPrintingSettingsPage() {
  const result = await getBranchListQuery(
    {},
    await getTenantServerApiRequestOptions(),
  )
    .then((branches) => ({ branches, error: undefined }))
    .catch((error: unknown) => ({
      branches: undefined,
      error: getErrorMessage(error),
    }));

  return (
    <BranchPrintingSettingsView
      initialBranches={result.branches}
      initialError={result.error}
    />
  );
}
