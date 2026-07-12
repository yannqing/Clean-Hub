import type { ApiClient, ApiRequestOptions } from "../../types";
import type {
  CreateTenantBackupJobRequest,
  CreateTenantRestoreRequestRequest,
  TenantBackupJobListItem,
  TenantBackupJobListQuery,
  TenantRestoreRequest,
  TenantRestoreRequestListQuery,
  TenantRestoreRequestListResult,
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

    /**
     * List the tenant's restore requests.
     *
     * Target endpoint: `GET /tenant/restore-requests`
     *
     * MOCK: returns an empty result set until the backend tenant restore-list
     * route exists.
     */
    async listRestoreRequests(
      query?: TenantRestoreRequestListQuery,
      options: TenantBackupRequestOptions = {},
    ): Promise<TenantRestoreRequestListResult> {
      // MOCK — wire to backend later:
      //   client.get<TenantRestoreRequestListResult>("/tenant/restore-requests", {
      //     ...options,
      //     query,
      //   })
      void client;
      void options;
      void query;
      return { items: [], total: 0 };
    },
  };
}
