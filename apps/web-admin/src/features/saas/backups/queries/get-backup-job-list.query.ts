import { webAdminApi } from "@/lib/api-client";

import type { BackupJobListItem, BackupJobListQuery } from "../types";

export async function getBackupJobListQuery(
  query?: BackupJobListQuery,
): Promise<BackupJobListItem[]> {
  return webAdminApi.http.request<BackupJobListItem[]>("/saas/backups", {
    query,
  });
}
