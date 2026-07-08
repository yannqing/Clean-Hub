import type {
  WhatsAppCredentialsFormValues,
  WhatsAppCredentialsValidation,
} from "../types";

type CredentialErrors = Partial<
  Record<keyof WhatsAppCredentialsFormValues, string>
>;

/**
 * Validate a WhatsApp Business API credential form submission.
 *
 * Rules mirror what the backend will enforce once the credential endpoint
 * exists. Front-end validation runs first to give immediate feedback and to
 * avoid sending obviously-invalid payloads (the access token in particular
 * should never travel unless the other fields are well-formed).
 *
 *   - wabaId: required, 8–24 digits.
 *   - phoneNumberId: required, 8–24 digits.
 *   - accessToken: required, 16–512 chars (Meta system-user tokens are long).
 *   - templateNamespace: optional; when present, 1–64 alphanumerics/underscore.
 */
export function validateWhatsAppCredentials(
  input: WhatsAppCredentialsFormValues,
): WhatsAppCredentialsValidation {
  const errors: CredentialErrors = {};
  const normalized: WhatsAppCredentialsFormValues = {
    wabaId: input.wabaId.trim(),
    phoneNumberId: input.phoneNumberId.trim(),
    accessToken: input.accessToken.trim(),
    templateNamespace: input.templateNamespace.trim(),
  };

  if (!normalized.wabaId) {
    errors.wabaId = "WhatsApp Business Account ID is required.";
  } else if (!/^\d{8,24}$/.test(normalized.wabaId)) {
    errors.wabaId = "WABA ID must be 8–24 digits.";
  }

  if (!normalized.phoneNumberId) {
    errors.phoneNumberId = "Phone Number ID is required.";
  } else if (!/^\d{8,24}$/.test(normalized.phoneNumberId)) {
    errors.phoneNumberId = "Phone Number ID must be 8–24 digits.";
  }

  if (!normalized.accessToken) {
    errors.accessToken = "Access token is required.";
  } else if (normalized.accessToken.length < 16) {
    errors.accessToken = "Access token looks too short.";
  } else if (normalized.accessToken.length > 512) {
    errors.accessToken = "Access token must be 512 characters or fewer.";
  }

  if (
    normalized.templateNamespace &&
    !/^[A-Za-z0-9_]{1,64}$/.test(normalized.templateNamespace)
  ) {
    errors.templateNamespace =
      "Template namespace may only contain letters, numbers, and underscores (1–64 chars).";
  }

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      errors,
      message: Object.values(errors)[0] ?? "Check the WhatsApp credentials.",
    };
  }

  return { ok: true, data: normalized };
}
