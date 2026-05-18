import type { ApiClient, QueryParams } from "../types";
import { createSaasAuditLogsApi } from "./audit-logs";
import { createSaasOverviewApi } from "./overview";
import { createSaasPlatformSettingsApi } from "./platform-settings";
import type { UpdatePlatformSettingsRequest } from "./platform-settings.types";
import { createSaasRolesApi } from "./roles";
import { createSaasTenantsApi } from "./tenants";
import type {
  CreateTenantRequest,
  UpdateTenantFeatureFlagsRequest,
  UpdateTenantSettingsRequest,
  UpdateTenantRequest,
  UpdateTenantStatusRequest,
} from "./tenants.types";
import { createSaasUsersApi } from "./users";
import type {
  UpdateSaasUserRequest,
  UpdateSaasUserRolesRequest,
} from "./users.types";

export * from "./audit-logs";
export * from "./audit-logs.types";
export * from "./overview";
export * from "./overview.types";
export * from "./platform-settings";
export * from "./platform-settings.types";
export * from "./roles";
export * from "./roles.types";
export * from "./tenants";
export * from "./tenants.types";
export * from "./users";
export * from "./users.types";

export function createSaasApi(client: ApiClient) {
  const tenants = createSaasTenantsApi(client);
  const users = createSaasUsersApi(client);
  const roles = createSaasRolesApi(client);
  const auditLogs = createSaasAuditLogsApi(client);
  const overview = createSaasOverviewApi(client);
  const platformSettings = createSaasPlatformSettingsApi(client);

  return {
    tenants,
    users,
    roles,
    auditLogs,
    overview,
    platformSettings,
    listTenants: (query?: QueryParams) => tenants.list(query),
    createTenant: (input: CreateTenantRequest) => tenants.create(input),
    getTenant: (tenantId: string) => tenants.get(tenantId),
    updateTenant: (tenantId: string, input: UpdateTenantRequest) =>
      tenants.update(tenantId, input),
    getTenantFeatureFlags: (tenantId: string) =>
      tenants.getFeatureFlags(tenantId),
    updateTenantFeatureFlags: (
      tenantId: string,
      input: UpdateTenantFeatureFlagsRequest,
    ) => tenants.updateFeatureFlags(tenantId, input),
    getTenantSettings: (tenantId: string) => tenants.getSettings(tenantId),
    updateTenantSettings: (
      tenantId: string,
      input: UpdateTenantSettingsRequest,
    ) => tenants.updateSettings(tenantId, input),
    updateTenantStatus: (tenantId: string, input: UpdateTenantStatusRequest) =>
      tenants.updateStatus(tenantId, input),
    listUsers: (query?: QueryParams) => users.list(query),
    getUser: (userId: string) => users.get(userId),
    updateUser: (userId: string, input: UpdateSaasUserRequest) =>
      users.update(userId, input),
    updateUserRoles: (userId: string, input: UpdateSaasUserRolesRequest) =>
      users.updateRoles(userId, input),
    listRoles: () => roles.list(),
    listAuditLogs: (query?: QueryParams) => auditLogs.list(query),
    getAuditLog: (logId: string) => auditLogs.get(logId),
    getOverview: () => overview.get(),
    getPlatformSettings: () => platformSettings.get(),
    updatePlatformSettings: (input: UpdatePlatformSettingsRequest) =>
      platformSettings.update(input),
    test: () => users.test(),
  };
}
