export type TenantUserSummary = {
  id: string;
  email: string | null;
  displayName: string;
  role: string;
  branchIds: string[];
  status: string;
};
