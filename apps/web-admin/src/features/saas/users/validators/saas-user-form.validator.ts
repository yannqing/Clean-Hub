import type {
  CreateSaasUserRequest,
  UpdateSaasUserRequest,
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

export type UpdateSaasUserFormInput = {
  email: string;
  phone?: string;
  displayName: string;
  language: SaasUserLanguage;
  timezone: string;
};

export type SaasUserFormResult<TData> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      errors: Record<string, string>;
    };

function validateEmail(email: string): string | null {
  const trimmed = email.trim();

  if (!trimmed) {
    return "Email is required.";
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

export function validateInviteSaasUserForm(
  input: InviteSaasUserFormInput,
): SaasUserFormResult<CreateSaasUserRequest> {
  const errors: Record<string, string> = {};
  const emailError = validateEmail(input.email);
  const displayName = input.displayName.trim();
  const password = input.password.trim();

  if (emailError) {
    errors.email = emailError;
  }

  if (!displayName) {
    errors.displayName = "Display name is required.";
  }

  if (password.length < 6) {
    errors.password = "Password must be at least 6 characters.";
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
): SaasUserFormResult<UpdateSaasUserRequest> {
  const errors: Record<string, string> = {};
  const emailError = validateEmail(input.email);
  const displayName = input.displayName.trim();
  const timezone = input.timezone.trim();

  if (emailError) {
    errors.email = emailError;
  }

  if (!displayName) {
    errors.displayName = "Display name is required.";
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
