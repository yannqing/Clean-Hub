import type { ApiClient, QueryParams } from "../types";
import { createSaasAuditLogsApi } from "./audit-logs";
import { createSaasBackupsApi } from "./backups";
import type {
  BackupJobListQuery,
  CreateBackupJobRequest,
  CreateRestoreRequestRequest,
} from "./backups.types";
import { createSaasFeedbackTicketsApi } from "./feedback-tickets";
import type {
  FeedbackTicketListQuery,
  UpdateFeedbackTicketAssigneeRequest,
  UpdateFeedbackTicketStatusRequest,
} from "./feedback-tickets.types";
import { createSaasOverviewApi } from "./overview";
import { createSaasOperationLogsApi } from "./operation-logs";
import type { OperationLogListQuery } from "./operation-logs.types";
import { createSaasPlatformSettingsApi } from "./platform-settings";
import type { UpdatePlatformSettingsRequest } from "./platform-settings.types";
import { createSaasRolesApi } from "./roles";
import { createSaasRestoreRequestsApi } from "./restore-requests";
import type { RestoreRequestListQuery } from "./restore-requests.types";
import { createSaasSecurityEventsApi } from "./security-events";
import type { SecurityEventListQuery } from "./security-events.types";
import { createSaasSecuritySettingsApi } from "./security-settings";
import type { UpdateSecuritySettingsRequest } from "./security-settings.types";
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
export * from "./backups";
export * from "./backups.types";
export * from "./feedback-tickets";
export * from "./feedback-tickets.types";
export * from "./overview";
export * from "./overview.types";
export * from "./operation-logs";
export * from "./operation-logs.types";
export * from "./platform-settings";
export * from "./platform-settings.types";
export * from "./roles";
export * from "./roles.types";
export * from "./restore-requests";
export * from "./restore-requests.types";
export * from "./security-events";
export * from "./security-events.types";
export * from "./security-settings";
export * from "./security-settings.types";
export * from "./tenants";
export * from "./tenants.types";
export * from "./users";
export * from "./users.types";

export function createSaasApi(client: ApiClient) {
  const tenants = createSaasTenantsApi(client);
  const users = createSaasUsersApi(client);
  const roles = createSaasRolesApi(client);
  const auditLogs = createSaasAuditLogsApi(client);
  const backups = createSaasBackupsApi(client);
  const feedbackTickets = createSaasFeedbackTicketsApi(client);
  const overview = createSaasOverviewApi(client);
  const operationLogs = createSaasOperationLogsApi(client);
  const platformSettings = createSaasPlatformSettingsApi(client);
  const restoreRequests = createSaasRestoreRequestsApi(client);
  const securityEvents = createSaasSecurityEventsApi(client);
  const securitySettings = createSaasSecuritySettingsApi(client);

  return {
    tenants,
    users,
    roles,
    auditLogs,
    backups,
    feedbackTickets,
    overview,
    operationLogs,
    platformSettings,
    restoreRequests,
    securityEvents,
    securitySettings,
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
    listBackupJobs: (query?: BackupJobListQuery) => backups.list(query),
    createBackupJob: (input: CreateBackupJobRequest) =>
      backups.create(input),
    createRestoreRequest: (
      backupJobId: string,
      input: CreateRestoreRequestRequest,
    ) => backups.createRestoreRequest(backupJobId, input),
    listRestoreRequests: (query?: RestoreRequestListQuery) =>
      restoreRequests.list(query),
    listSecurityEvents: (query?: SecurityEventListQuery) =>
      securityEvents.list(query),
    listOperationLogs: (query?: OperationLogListQuery) =>
      operationLogs.list(query),
    getSecuritySettings: () => securitySettings.get(),
    updateSecuritySettings: (input: UpdateSecuritySettingsRequest) =>
      securitySettings.update(input),
    listFeedbackTickets: (query?: FeedbackTicketListQuery) =>
      feedbackTickets.list(query),
    getFeedbackTicket: (ticketId: string) => feedbackTickets.get(ticketId),
    updateFeedbackTicketStatus: (
      ticketId: string,
      input: UpdateFeedbackTicketStatusRequest,
    ) => feedbackTickets.updateStatus(ticketId, input),
    updateFeedbackTicketAssignee: (
      ticketId: string,
      input: UpdateFeedbackTicketAssigneeRequest,
    ) => feedbackTickets.updateAssignee(ticketId, input),
    getOverview: () => overview.get(),
    getPlatformSettings: () => platformSettings.get(),
    updatePlatformSettings: (input: UpdatePlatformSettingsRequest) =>
      platformSettings.update(input),
    test: () => users.test(),
  };
}
