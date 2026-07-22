import type { ApiClient } from "../types";
import { createPosTerminalAuthApi } from "./auth";
import { createPosAccountsApi } from "./accounts";
import { createPosBranchesApi } from "./branches";
import { createPosCatalogApi } from "./catalog";
import { createPosCustomersApi } from "./customers";
import { createPosNotificationsApi } from "./notifications";
import { createPosOrdersApi } from "./orders";
import { createPosPaymentAdjustmentsApi } from "./payment-adjustments";
import { createPosOverviewApi } from "./overview";
import { createPosReceptionApi } from "./reception";
import { createPosSearchApi } from "./search";
import { createPosServiceTicketsApi } from "./service-tickets";
import { createPosStaffApi } from "./staff";
import { createPosTerminalSettingsApi } from "./terminal-settings";
import { createPosHardwareApi } from "./hardware";
import { createPosStatisticsApi } from "./statistics";
import { createPosWorkspaceApi } from "./workspace";

export * from "./auth";
export * from "./auth.types";
export * from "./accounts";
export * from "./accounts.types";
export * from "./branches";
export * from "./branches.types";
export * from "./catalog";
export * from "./catalog.types";
export * from "./customers";
export * from "./customers.types";
export * from "./notifications";
export * from "./notifications.types";
export * from "./orders";
export * from "./orders.types";
export * from "./payment-adjustments";
export * from "./payment-adjustments.types";
export * from "./overview";
export * from "./overview.types";
export * from "./reception";
export * from "./reception.types";
export * from "./search";
export * from "./search.types";
export * from "./service-tickets";
export * from "./service-tickets.types";
export * from "./staff";
export * from "./staff.types";
export * from "./terminal-settings";
export * from "./terminal-settings.types";
export * from "./hardware";
export * from "./hardware.types";
export * from "./statistics";
export * from "./statistics.types";
export * from "./workspace";
export * from "./workspace.types";

export function createPosApi(client: ApiClient) {
  return {
    branches: createPosBranchesApi(client),
    catalog: createPosCatalogApi(client),
    customers: createPosCustomersApi(client),
    serviceTickets: createPosServiceTicketsApi(client),
    accounts: createPosAccountsApi(client),
    orders: createPosOrdersApi(client),
    paymentAdjustments: createPosPaymentAdjustmentsApi(client),
    search: createPosSearchApi(client),
    overview: createPosOverviewApi(client),
    staff: createPosStaffApi(client),
    reception: createPosReceptionApi(client),
    /**
     * POS-terminal enrollment, credential rotation, and terminal lock APIs.
     * Named `terminalAuth` to avoid clashing with the platform-wide login
     * session exposed at `posApi.auth` (wired by createCleanHubApiClient).
     */
    terminalAuth: createPosTerminalAuthApi(client),
    notifications: createPosNotificationsApi(client),
    terminalSettings: createPosTerminalSettingsApi(client),
    hardware: createPosHardwareApi(client),
    statistics: createPosStatisticsApi(client),
    workspace: createPosWorkspaceApi(client),
  };
}
