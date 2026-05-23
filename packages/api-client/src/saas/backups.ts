import type { ApiClient } from "../types";
import type {
  BackupJobListItem,
  BackupJobListQuery,
  CreateBackupJobRequest,
  CreateRestoreRequestRequest,
} from "./backups.types";
import type { RestoreRequest } from "./restore-requests.types";

export function createSaasBackupsApi(client: ApiClient) {
  return {
    list: (query?: BackupJobListQuery) =>
      client.get<BackupJobListItem[]>("/saas/backups", { query }),
    create: (input: CreateBackupJobRequest) =>
      client.post<BackupJobListItem>("/saas/backups", input),
    createRestoreRequest: (
      backupJobId: string,
      input: CreateRestoreRequestRequest,
    ) =>
      client.post<RestoreRequest>(
        `/saas/backups/${backupJobId}/restore-requests`,
        input,
      ),
  };
}
