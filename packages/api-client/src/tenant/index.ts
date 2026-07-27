import type { ApiClient } from "../types";
// Resources grouped by domain. The insights/ folder holds operation-data
// resources (overview, reports, audit-logs) that share no cross-type deps but
// belong to the same "tenant observability" concern.
import {
  createTenantAuditLogsApi,
  createTenantOverviewApi,
  createTenantReportsApi,
} from "./insights";
import { createTenantBackupsApi } from "./backups";
import { createTenantBranchesApi } from "./branches";
import {
  createTenantPricesApi,
  createTenantProductsApi,
  createTenantServicesApi,
} from "./catalog";
import { createTenantDiscountsApi } from "./discounts";
import { createTenantFinanceApi } from "./finance";
import { createTenantHardwareApi } from "./hardware";
import { createTenantNotificationsApi } from "./notifications";
import { createTenantPosChannelApi } from "./pos-channel";
import { createTenantSettingsApi } from "./settings";

export * from "./insights";
export * from "./backups";
export * from "./branches";
export * from "./catalog";
export * from "./discounts";
export * from "./finance";
export * from "./hardware";
export * from "./notifications";
export * from "./pos-channel";
// NOTE: settings types are exported explicitly below (not via `export *`),
// because `TenantSettings` / `UpdateTenantSettingsRequest` collide with the
// SaaS-domain types of the same name (see ../saas/tenants). They are re-exported
// here under the `*BackOffice*` aliases so both names coexist at the package barrel.
export type {
  TenantPilotStatus,
  TenantSettingsFeatureFlags,
  TenantSettingsLanguage,
  TenantSettings as TenantBackOfficeSettings,
  UpdateTenantSettingsRequest as UpdateTenantBackOfficeSettingsRequest,
} from "./settings";

export function createTenantApi(client: ApiClient) {
  const auditLogs = createTenantAuditLogsApi(client);
  const backups = createTenantBackupsApi(client);
  const branches = createTenantBranchesApi(client);
  const overview = createTenantOverviewApi(client);
  const settings = createTenantSettingsApi(client);
  const services = createTenantServicesApi(client);
  const prices = createTenantPricesApi(client);
  const products = createTenantProductsApi(client);
  const discounts = createTenantDiscountsApi(client);
  const finance = createTenantFinanceApi(client);
  const hardware = createTenantHardwareApi(client);
  const notifications = createTenantNotificationsApi(client);
  const posChannel = createTenantPosChannelApi(client);
  const reports = createTenantReportsApi(client);

  return {
    auditLogs,
    backups,
    branches,
    overview,
    settings,
    services,
    prices,
    products,
    discounts,
    finance,
    hardware,
    notifications,
    posChannel,
    reports,
  };
}
