import type { ApiClient } from "../types";
import type { SaasRoleSummary } from "./roles.types";

export function createSaasRolesApi(client: ApiClient) {
  const listSaasRoles = () => client.get<SaasRoleSummary[]>("/saas/roles");

  return {
    getSaasRoles: listSaasRoles,
    list: listSaasRoles,
    listSaasRoles,
  };
}
