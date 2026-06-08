import type { ApiClient, QueryParams } from "../types";
import { createTenantAuditLogsApi } from "./audit-logs";
import { createTenantBackupsApi } from "./backups";
import type {
  CreateTenantBackupJobRequest,
  CreateTenantRestoreRequestRequest,
} from "./backups.types";
import { createTenantBranchesApi } from "./branches";
import type {
  CreateBranchRequest,
  UpdateBranchRequest,
  UpdateBranchStatusRequest,
} from "./branches.types";
import { createTenantHardwareApi } from "./hardware";
import { createTenantNotificationsApi } from "./notifications";
import type { UpdateTenantNotificationSettingsRequest } from "./notifications.types";
import { createTenantOverviewApi } from "./overview";
import { createTenantPricesApi } from "./prices";
import { createTenantReportsApi } from "./reports";
import { createTenantServicesApi } from "./services";
import { createTenantSettingsApi } from "./settings";
import { createTenantUsersApi } from "./users";
import type {
  CreateTenantUserRequest,
  ResetTenantUserPinRequest,
  UpdateTenantUserRequest,
} from "./users.types";
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
    listAuditLogs: (query?: QueryParams) => auditLogs.list(query),
    getAuditLog: (logId: string) => auditLogs.get(logId),
    listBackupJobs: (query?: Parameters<typeof backups.list>[0]) =>
      backups.list(query),
    createBackupJob: (input?: CreateTenantBackupJobRequest) =>
      backups.create(input),
    createRestoreRequest: (
      backupJobId: string,
      input: CreateTenantRestoreRequestRequest,
    ) => backups.createRestoreRequest(backupJobId, input),
    listBranches: (query?: Parameters<typeof branches.list>[0]) =>
      branches.list(query),
    getBranch: (branchId: string) => branches.get(branchId),
    createBranch: (input: CreateBranchRequest) => branches.create(input),
    updateBranch: (branchId: string, input: UpdateBranchRequest) =>
      branches.update(branchId, input),
    updateBranchStatus: (
      branchId: string,
      input: UpdateBranchStatusRequest,
    ) => branches.updateStatus(branchId, input),
    listUsers: (query?: QueryParams) => users.list(query),
    getUser: (userId: string) => users.get(userId),
    createUser: (input: CreateTenantUserRequest) => users.create(input),
    updateUser: (userId: string, input: UpdateTenantUserRequest) =>
      users.update(userId, input),
    disableUser: (userId: string) => users.disable(userId),
    enableUser: (userId: string) => users.enable(userId),
    resetUserPin: (userId: string, input: ResetTenantUserPinRequest) =>
      users.resetPin(userId, input),
    listServices: (query?: QueryParams) => services.list(query),
    listPrices: (query?: QueryParams) => prices.list(query),
    listDevices: (query?: QueryParams) => hardware.listDevices(query),
    getNotificationSettings: () => notifications.getSettings(),
    updateNotificationSettings: (
      input: UpdateTenantNotificationSettingsRequest,
    ) => notifications.updateSettings(input),
    getReportSummary: (query?: QueryParams) => reports.getSummary(query),
  };
}
