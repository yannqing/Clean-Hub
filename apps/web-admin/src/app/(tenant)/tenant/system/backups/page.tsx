import { redirect } from "next/navigation";

import { isNavFeatureVisible } from "@/config/feature-visibility";
import { webAdminRoutes } from "@/config/routes";
import {
  BackupJobListView,
  getTenantBackupJobListQuery,
  type BackupJobListQuery,
  type BackupJobStatus,
} from "@/features/tenant/backups";

type TenantSystemBackupsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const backupStatuses = new Set<BackupJobStatus>([
  "pending",
  "running",
  "succeeded",
  "failed",
]);

function getStringParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = searchParams[key];

  return Array.isArray(value) ? value[0] : value;
}

export default async function TenantSystemBackupsPage({
  searchParams,
}: TenantSystemBackupsPageProps) {
  if (!isNavFeatureVisible("backups")) {
    redirect(webAdminRoutes.tenant.home);
  }

  const params = (await searchParams) ?? {};
  const status = getStringParam(params, "status");
  const query: BackupJobListQuery = {
    status: backupStatuses.has(status as BackupJobStatus)
      ? (status as BackupJobStatus)
      : undefined,
  };
  const backupJobs = await getTenantBackupJobListQuery(query);

  return <BackupJobListView initialBackupJobs={backupJobs} />;
}
