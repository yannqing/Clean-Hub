import type { ApiClient, QueryParams } from "../types";
import { createSaasAuditLogsApi } from "./audit-logs";
import { createSaasTenantsApi } from "./tenants";
import type {
  CreateTenantRequest,
  UpdateTenantRequest,
  UpdateTenantStatusRequest,
} from "./tenants.types";
import { createSaasUsersApi } from "./users";
import type { UpdateSaasUserRequest } from "./users.types";

export * from "./audit-logs";
export * from "./audit-logs.types";
export * from "./tenants";
export * from "./tenants.types";
export * from "./users";
export * from "./users.types";

export function createSaasApi(client: ApiClient) {
  const tenants = createSaasTenantsApi(client);
  const users = createSaasUsersApi(client);
  const auditLogs = createSaasAuditLogsApi(client);

  return {
    tenants,
    users,
    auditLogs,
    listTenants: (query?: QueryParams) => tenants.list(query),
    createTenant: (input: CreateTenantRequest) => tenants.create(input),
    getTenant: (tenantId: string) => tenants.get(tenantId),
    updateTenant: (tenantId: string, input: UpdateTenantRequest) =>
      tenants.update(tenantId, input),
    updateTenantStatus: (tenantId: string, input: UpdateTenantStatusRequest) =>
      tenants.updateStatus(tenantId, input),
    listUsers: (query?: QueryParams) => users.list(query),
    getUser: (userId: string) => users.get(userId),
    updateUser: (userId: string, input: UpdateSaasUserRequest) =>
      users.update(userId, input),
    listAuditLogs: (query?: QueryParams) => auditLogs.list(query),
    test: () => users.test(),
  };
}
