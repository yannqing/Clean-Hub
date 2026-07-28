import type {
  TenantProfile,
  TenantProfileLanguage,
} from "@cleanhub/api-client";

export type { TenantProfile, TenantProfileLanguage };

export type TenantProfileFormValues = {
  displayName: string;
  language: Extract<TenantProfileLanguage, "en" | "zh-CN">;
};

export type TenantProfileFormErrorCode =
  | "displayNameRequired"
  | "displayNameTooLong"
  | "invalidLanguage";

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
  | "TENANT_PROFILE_CONFLICT"
  | "UNKNOWN";

