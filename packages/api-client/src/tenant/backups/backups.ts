import type { ApiClient, ApiRequestOptions } from "../../types";
import type {
  CreateTenantBackupJobRequest,
  CreateTenantRestoreRequestRequest,
  TenantBackupJobListItem,
  TenantBackupJobListQuery,
  TenantRestoreRequest,
} from "./backups.types";

type TenantBackupRequestOptions = Omit<
  ApiRequestOptions,
  "method" | "body" | "query"
>;

export function createTenantBackupsApi(client: ApiClient) {
  return {
    list: (
      query?: TenantBackupJobListQuery,
      options: TenantBackupRequestOptions = {},
    ) =>
      client.get<TenantBackupJobListItem[]>("/tenant/backups", {
        ...options,
        query,
      }),
    create: (
      input: CreateTenantBackupJobRequest = {},
      options: TenantBackupRequestOptions = {},
    ) => client.post<TenantBackupJobListItem>("/tenant/backups", input, options),
    createRestoreRequest: (
      backupJobId: string,
      input: CreateTenantRestoreRequestRequest,
      options: TenantBackupRequestOptions = {},
    ) =>
      client.post<TenantRestoreRequest>(
        `/tenant/backups/${backupJobId}/restore-requests`,
        input,
        options,
      ),
  };
}
