import type { ApiClient } from "../types";
// Resources are grouped into subdirectories by domain. Some factories live in a
// sibling resource's folder because they share types (e.g. restore-requests
// belongs under backups/ since backups.ts imports RestoreRequest).
import { createSaasAuditLogsApi, createSaasOperationLogsApi } from "./audit";
import { createSaasBackupsApi, createSaasRestoreRequestsApi } from "./backups";
import { createSaasFeedbackTicketsApi } from "./feedback-tickets";
import { createSaasOverviewApi } from "./overview";
import { createSaasProfileApi } from "./profile";
import { createSaasPlatformSettingsApi } from "./platform-settings";
import { createSaasRolesApi, createSaasUsersApi } from "./identity";
import {
  createSaasSecurityEventsApi,
  createSaasSecuritySettingsApi,
} from "./security";
import { createSaasTenantsApi } from "./tenants";

export * from "./audit";
export * from "./backups";
export * from "./feedback-tickets";
export * from "./overview";
export * from "./profile";
export * from "./platform-settings";
export * from "./identity";
export * from "./security";
export * from "./tenants";

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
    profile: createSaasProfileApi(client),
    operationLogs,
    platformSettings,
    restoreRequests,
    securityEvents,
    securitySettings,
  };
}
