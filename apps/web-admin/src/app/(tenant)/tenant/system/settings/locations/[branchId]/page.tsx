import { Badge, Button } from "@cleanhub/ui";
import Link from "next/link";

import { webAdminRoutes } from "@/config/routes";
import { BranchDetailView } from "@/features/tenant/branches/components";
import { getBranchDetailQuery } from "@/features/tenant/branches/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { TenantSettingsSurface } from "@/features/tenant/settings/components";

type TenantSettingsLocationDetailPageProps = {
  params: Promise<{
    branchId: string;
  }>;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Branch detail failed to load.";
}

export default async function TenantSettingsLocationDetailPage({
  params,
}: TenantSettingsLocationDetailPageProps) {
  const { branchId } = await params;
  const locationsPath = webAdminRoutes.tenant.system.settingsSections.locations;
  const result = await getBranchDetailQuery(
    branchId,
    await getTenantServerApiRequestOptions(),
  )
    .then((branch) => ({ branch, error: undefined }))
    .catch((error: unknown) => ({
      branch: undefined,
      error: getErrorMessage(error),
    }));

  return (
    <TenantSettingsSurface>
      {result.branch ? (
        <BranchDetailView
          basePath={locationsPath}
          embedded
          initialBranch={result.branch}
        />
      ) : (
        <section className="grid gap-5 p-5">
          <div className="rounded-md border bg-background p-5">
            <Badge variant="secondary">Branch unavailable</Badge>
            <h2 className="mt-3 text-xl font-semibold tracking-normal">
              Branch could not be loaded
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {result.error ??
                `Branch ${branchId} may be outside the current user's branch scope or unavailable.`}
            </p>
            <Button asChild className="mt-5" type="button" variant="outline">
              <Link href={locationsPath}>Back to locations</Link>
            </Button>
          </div>
        </section>
      )}
    </TenantSettingsSurface>
  );
}
