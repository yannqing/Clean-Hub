import type {
  CreateSaasUserRequest,
  UpdateSaasUserRequest,
  UpdateSaasUserRolesRequest,
} from "@cleanhub/api-client";

import type { SaasUserLanguage, SaasUserRoleCode } from "../types";

export type InviteSaasUserFormInput = {
  email: string;
  phone?: string;
  displayName: string;
  password: string;
  roleCode: SaasUserRoleCode;
  language: SaasUserLanguage;
};

export type InviteSaasUserFormErrors = Partial<
  Record<keyof InviteSaasUserFormInput, string>
>;

export type UpdateSaasUserFormErrors = Partial<
  Record<keyof UpdateSaasUserFormInput, string>
>;

export type UpdateSaasUserRolesFormErrors = {
  roleCodes?: string;
};

export type UpdateSaasUserFormInput = {
  email: string;
  phone?: string;
  displayName: string;
  language: SaasUserLanguage;
  timezone: string;
};

export type UpdateSaasUserRolesFormInput = {
  roleCodes: SaasUserRoleCode[];
};

export type SaasUserFormResult<TData, TErrors = Record<string, string>> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      errors: TErrors;
    };

const saasUserLanguages = ["en", "fr", "zh-CN"] as const;

function validateEmail(email: string): string | null {
  const trimmed = email.trim();

  if (!trimmed) {
    return "Email is required.";
  }

  if (trimmed.length > 320) {
    return "Email must be 320 characters or fewer.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "Email must be valid.";
  }

  return null;
}

function normalizeOptionalPhone(phone: string | undefined): string | undefined {
  const trimmed = phone?.trim();

  return trimmed ? trimmed : undefined;
}

function validateOptionalPhone(phone: string | undefined): string | null {
  const trimmed = normalizeOptionalPhone(phone);

  if (!trimmed) {
    return null;
  }

  if (trimmed.length < 3 || trimmed.length > 32) {
    return "Phone must be 3 to 32 characters.";
  }

  if (!/^\+?[0-9][0-9\s().-]*$/.test(trimmed)) {
    return "Phone must use numbers and common phone symbols.";
  }

  return null;
}

export function validateInviteSaasUserForm(
  input: InviteSaasUserFormInput,
): SaasUserFormResult<CreateSaasUserRequest, InviteSaasUserFormErrors> {
  const errors: InviteSaasUserFormErrors = {};
  const emailError = validateEmail(input.email);
  const phoneError = validateOptionalPhone(input.phone);
  const displayName = input.displayName.trim();
  const password = input.password.trim();

  if (emailError) {
    errors.email = emailError;
  }

  if (phoneError) {
    errors.phone = phoneError;
  }

  if (!displayName) {
    errors.displayName = "Display name is required.";
  }

  if (displayName.length > 120) {
    errors.displayName = "Display name must be 120 characters or fewer.";
  }

  if (password.length < 6) {
    errors.password = "Password must be at least 6 characters.";
  }

  if (password.length > 128) {
    errors.password = "Password must be 128 characters or fewer.";
  }

  if (input.roleCode !== "support" && input.roleCode !== "super_admin") {
    errors.roleCode = "Select a valid SaaS role.";
  }

  if (!saasUserLanguages.includes(input.language)) {
    errors.language = "Select a valid language.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      displayName,
      email: input.email.trim(),
      language: input.language,
      password,
      phone: normalizeOptionalPhone(input.phone),
      roleCode: input.roleCode,
    },
  };
}

export function validateUpdateSaasUserForm(
  input: UpdateSaasUserFormInput,
): SaasUserFormResult<UpdateSaasUserRequest, UpdateSaasUserFormErrors> {
  const errors: UpdateSaasUserFormErrors = {};
  const emailError = validateEmail(input.email);
  const phoneError = validateOptionalPhone(input.phone);
  const displayName = input.displayName.trim();
  const timezone = input.timezone.trim();

  if (emailError) {
    errors.email = emailError;
  }

  if (phoneError) {
    errors.phone = phoneError;
  }

  if (!displayName) {
    errors.displayName = "Display name is required.";
  }

  if (displayName.length > 120) {
    errors.displayName = "Display name must be 120 characters or fewer.";
  }

  if (!saasUserLanguages.includes(input.language)) {
    errors.language = "Select a valid language.";
  }

  if (!timezone) {
    errors.timezone = "Timezone is required.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      displayName,
      email: input.email.trim(),
      language: input.language,
      phone: normalizeOptionalPhone(input.phone) ?? null,
      timezone,
    },
  };
}

export function validateUpdateSaasUserRolesForm(
  input: UpdateSaasUserRolesFormInput,
): SaasUserFormResult<
  UpdateSaasUserRolesRequest,
  UpdateSaasUserRolesFormErrors
> {
  const roleCodes = [...new Set(input.roleCodes)].sort();

  if (roleCodes.length === 0) {
    return {
      ok: false,
      errors: {
        roleCodes: "Select at least one SaaS role.",
      },
    };
  }

  if (
    roleCodes.some(
      (roleCode) => roleCode !== "support" && roleCode !== "super_admin",
    )
  ) {
    return {
      ok: false,
      errors: {
        roleCodes: "Select valid SaaS roles only.",
      },
    };
  }

  return {
    ok: true,
    data: {
      roleCodes,
    },
  };
}
