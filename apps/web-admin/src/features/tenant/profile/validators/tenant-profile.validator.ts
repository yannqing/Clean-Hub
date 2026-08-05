import type {
  TenantPasswordFormErrors,
  TenantPasswordFormValues,
  TenantProfile,
  TenantProfileFormErrors,
  TenantProfileFormValues,
} from "../types";

type TenantProfileValidationResult =
  | {
      ok: true;
      data: TenantProfileFormValues;
    }
  | {
      ok: false;
      errors: TenantProfileFormErrors;
    };

type TenantPasswordValidationResult =
  | {
      ok: true;
      data: Pick<TenantPasswordFormValues, "currentPassword" | "newPassword">;
    }
  | {
      ok: false;
      errors: TenantPasswordFormErrors;
    };

export function validateTenantProfileForm(
  input: TenantProfileFormValues,
): TenantProfileValidationResult {
  const errors: TenantProfileFormErrors = {};
  const displayName = input.displayName.trim();

  if (!displayName) {
    errors.displayName = "displayNameRequired";
  } else if (displayName.length > 120) {
    errors.displayName = "displayNameTooLong";
  }

  if (
    input.language !== "en" &&
    input.language !== "fr" &&
    input.language !== "zh-CN"
  ) {
    errors.language = "invalidLanguage";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      displayName,
      language: input.language,
    },
  };
}

export function validateTenantPasswordForm(
  input: TenantPasswordFormValues,
  policy: TenantProfile["passwordPolicy"],
): TenantPasswordValidationResult {
  const errors: TenantPasswordFormErrors = {};

  if (!input.currentPassword) {
    errors.currentPassword = "currentPasswordRequired";
  }

  if (!input.newPassword) {
    errors.newPassword = "newPasswordRequired";
  } else if (input.newPassword.length < policy.passwordMinLength) {
    errors.newPassword = "passwordTooShort";
  } else if (policy.passwordRequiresNumber && !/\d/.test(input.newPassword)) {
    errors.newPassword = "passwordNumberRequired";
  } else if (
    policy.passwordRequiresSymbol &&
    !/[^A-Za-z0-9]/.test(input.newPassword)
  ) {
    errors.newPassword = "passwordSymbolRequired";
  }

  if (input.confirmPassword !== input.newPassword) {
    errors.confirmPassword = "passwordConfirmationMismatch";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
    },
  };
}
