import type { ApiClient, QueryParams } from "../types";
import { createTenantBranchesApi } from "./branches";
import { createTenantHardwareApi } from "./hardware";
import { createTenantPricesApi } from "./prices";
import { createTenantReportsApi } from "./reports";
import { createTenantServicesApi } from "./services";
import { createTenantUsersApi } from "./users";

export * from "./branches";
export * from "./branches.types";
export * from "./hardware";
export * from "./hardware.types";
export * from "./prices";
export * from "./prices.types";
export * from "./reports";
export * from "./reports.types";
export * from "./services";
export * from "./services.types";
export * from "./users";
export * from "./users.types";

export function createTenantApi(client: ApiClient) {
  const branches = createTenantBranchesApi(client);
  const users = createTenantUsersApi(client);
  const services = createTenantServicesApi(client);
  const prices = createTenantPricesApi(client);
  const hardware = createTenantHardwareApi(client);
  const reports = createTenantReportsApi(client);

  return {
    branches,
    users,
    services,
    prices,
    hardware,
    reports,
    listBranches: (query?: QueryParams) => branches.list(query),
    listUsers: (query?: QueryParams) => users.list(query),
    listServices: (query?: QueryParams) => services.list(query),
    listPriceBooks: (query?: QueryParams) => prices.list(query),
    listDevices: (query?: QueryParams) => hardware.listDevices(query),
    getReportSummary: (query?: QueryParams) => reports.getSummary(query),
  };
}
