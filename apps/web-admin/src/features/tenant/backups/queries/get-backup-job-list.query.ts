import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import type { BackupJobListItem, BackupJobListQuery } from "../types";

export async function getTenantBackupJobListQuery(
  query?: BackupJobListQuery,
): Promise<BackupJobListItem[]> {
  return webAdminApi.tenant.backups.list(
    query,
    await getTenantServerApiRequestOptions(),
  );
}
