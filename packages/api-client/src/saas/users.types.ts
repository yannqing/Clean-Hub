export type SaasUserSummary = {
  id: string;
  email: string | null;
  displayName: string;
  role: string;
  status: string;
  lastLoginAt?: string | null;
};
