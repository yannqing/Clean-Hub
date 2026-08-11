import type { TenantLoginSession, TenantProfile } from "@cleanhub/api-client";

export type { TenantLoginSession, TenantProfile };

export type TenantProfileFormValues = {
  displayName: string;
  email: string;
  phone: string;
};

export type TenantProfileFormErrorCode =
  | "displayNameRequired"
  | "displayNameTooLong"
  | "emailRequired"
  | "emailInvalid"
  | "emailTooLong"
  | "phoneTooLong";

export type TenantProfileFormErrors = Partial<
  Record<keyof TenantProfileFormValues, TenantProfileFormErrorCode>
>;

export type TenantPasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type TenantPasswordFormErrorCode =
  | "currentPasswordRequired"
  | "newPasswordRequired"
  | "passwordTooShort"
  | "passwordNumberRequired"
  | "passwordSymbolRequired"
  | "passwordConfirmationMismatch";

export type TenantPasswordFormErrors = Partial<
  Record<keyof TenantPasswordFormValues, TenantPasswordFormErrorCode>
>;

export type TenantProfileActionErrorCode =
  | TenantProfileFormErrorCode
  | TenantPasswordFormErrorCode
  | "CURRENT_PASSWORD_INCORRECT"
  | "NEW_PASSWORD_UNCHANGED"
  | "PASSWORD_POLICY_VIOLATION"
  | "TENANT_PROFILE_NOT_FOUND"
  | "TENANT_PROFILE_UPDATE_EMPTY"
  | "TENANT_PROFILE_EMAIL_CONFLICT"
  | "TENANT_PROFILE_CONFLICT"
  | "UNKNOWN";

export type TenantLoginSessionActionErrorCode =
  | "TENANT_LOGIN_SESSION_NOT_FOUND"
  | "TENANT_CURRENT_SESSION_REVOKE_FORBIDDEN"
  | "UNKNOWN";
