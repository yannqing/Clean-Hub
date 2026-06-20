import type { SaasUserRoleCode } from "./users.types";

export type SaasRoleSummary = {
  id: string;
  code: SaasUserRoleCode;
  name: string;
  description: string | null;
  status: "active" | "disabled";
  isSystem: boolean;
  permissions: string[];
};
