import type { ApiClient } from "../types";
import { createPosTerminalAuthApi } from "./auth";
import { createPosBranchesApi } from "./branches";
import { createPosCustomersApi } from "./customers";
import { createPosNotificationsApi } from "./notifications";
import { createPosOrdersApi } from "./orders";
import { createPosOverviewApi } from "./overview";
import { createPosReceptionApi } from "./reception";
import { createPosServiceTicketsApi } from "./service-tickets";
import { createPosStaffApi } from "./staff";

export * from "./auth";
export * from "./auth.types";
export * from "./branches";
export * from "./branches.types";
export * from "./customers";
export * from "./customers.types";
export * from "./notifications";
export * from "./notifications.types";
export * from "./orders";
export * from "./orders.types";
export * from "./overview";
export * from "./overview.types";
export * from "./reception";
export * from "./reception.types";
export * from "./service-tickets";
export * from "./service-tickets.types";
export * from "./staff";
export * from "./staff.types";

export function createPosApi(client: ApiClient) {
  return {
    branches: createPosBranchesApi(client),
    customers: createPosCustomersApi(client),
    serviceTickets: createPosServiceTicketsApi(client),
    orders: createPosOrdersApi(client),
    overview: createPosOverviewApi(client),
    staff: createPosStaffApi(client),
    reception: createPosReceptionApi(client),
    /**
     * POS-terminal-specific auth (PIN login, device binding, terminal lock).
     * Named `terminalAuth` to avoid clashing with the platform-wide login
     * session exposed at `posApi.auth` (wired by createCleanHubApiClient).
     */
    terminalAuth: createPosTerminalAuthApi(client),
    notifications: createPosNotificationsApi(client),
  };
}

