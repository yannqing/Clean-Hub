import type { ApiClient, QueryParams } from "../types";
import { createTenantAuditLogsApi } from "./audit-logs";
import { createTenantBackupsApi } from "./backups";
import { createTenantBranchesApi } from "./branches";
import { createTenantHardwareApi } from "./hardware";
import { createTenantNotificationsApi } from "./notifications";
import { createTenantOverviewApi } from "./overview";
import { createTenantPricesApi } from "./prices";
import { createTenantReportsApi } from "./reports";
import { createTenantServicesApi } from "./services";
import { createTenantSettingsApi } from "./settings";
import { createTenantUsersApi } from "./users";
import type { UpdateTenantSettingsRequest } from "./settings.types";

export * from "./audit-logs";
export * from "./audit-logs.types";
export * from "./backups";
export * from "./backups.types";
export * from "./branches";
export * from "./branches.types";
export * from "./hardware";
export * from "./hardware.types";
export * from "./notifications";
export * from "./notifications.types";
export * from "./overview";
export * from "./overview.types";
export * from "./prices";
export * from "./prices.types";
export * from "./reports";
export * from "./reports.types";
export * from "./services";
export * from "./services.types";
export * from "./settings";
export type {
  TenantPilotStatus,
  TenantSettingsFeatureFlags,
  TenantSettingsLanguage,
  TenantSettings as TenantBackOfficeSettings,
  UpdateTenantSettingsRequest as UpdateTenantBackOfficeSettingsRequest,
} from "./settings.types";
export * from "./users";
export * from "./users.types";

export function createTenantApi(client: ApiClient) {
  const auditLogs = createTenantAuditLogsApi(client);
  const backups = createTenantBackupsApi(client);
  const branches = createTenantBranchesApi(client);
  const overview = createTenantOverviewApi(client);
  const settings = createTenantSettingsApi(client);
  const users = createTenantUsersApi(client);
  const services = createTenantServicesApi(client);
  const prices = createTenantPricesApi(client);
  const hardware = createTenantHardwareApi(client);
  const notifications = createTenantNotificationsApi(client);
  const reports = createTenantReportsApi(client);

  return {
    auditLogs,
    backups,
    branches,
    overview,
    settings,
    users,
    services,
    prices,
    hardware,
    notifications,
    reports,
    getOverview: (options?: Parameters<typeof overview.get>[0]) =>
      overview.get(options),
    getSettings: (options?: Parameters<typeof settings.get>[0]) =>
      settings.get(options),
    updateSettings: (
      input: UpdateTenantSettingsRequest,
      options?: Parameters<typeof settings.update>[1],
    ) => settings.update(input, options),
    listBackupJobs: (query?: Parameters<typeof backups.list>[0]) =>
      backups.list(query),
    listBranches: (query?: Parameters<typeof branches.list>[0]) =>
      branches.list(query),
    listUsers: (query?: QueryParams) => users.list(query),
    listServices: (query?: QueryParams) => services.list(query),
    listPrices: (query?: QueryParams) => prices.list(query),
    listDevices: (query?: QueryParams) => hardware.listDevices(query),
    getReportSummary: (query?: QueryParams) => reports.getSummary(query),
  };
}
