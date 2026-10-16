import { isSaasAdminRole, type AdminRole } from "@cleanhub/domain";

export const AUTH_REDIRECT_REASON_PARAM = "reason";

export const AUTH_REDIRECT_REASONS = {
  sessionExpired: "session_expired",
  tenantAccessDenied: "tenant_access_denied",
} as const;

export type AuthRedirectReason =
  (typeof AUTH_REDIRECT_REASONS)[keyof typeof AUTH_REDIRECT_REASONS];

type WebAdminAuthContext = {
  role: AdminRole;
  tenantId: string | null;
};

export function getWebAdminHomePath(
  authContext: WebAdminAuthContext,
): "/saas" | "/tenant" | null {
  if (isSaasAdminRole(authContext.role)) {
    return "/saas";
  }

  if (
    authContext.tenantId &&
    (authContext.role === "owner" || authContext.role === "manager")
  ) {
    return "/tenant";
  }

  return null;
}

export function isAuthRedirectReason(
  value: string | undefined,
): value is AuthRedirectReason {
  return Object.values(AUTH_REDIRECT_REASONS).some(
    (reason) => reason === value,
  );
}
