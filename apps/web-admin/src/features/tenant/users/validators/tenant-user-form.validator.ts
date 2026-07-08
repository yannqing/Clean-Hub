import { isUlid } from "@cleanhub/id";

import type {
  CreateTenantUserRequest,
  UpdateTenantUserRequest,
} from "@cleanhub/api-client";

/**
 * Tenant user form validators.
 *
 * These mirror the backend zod schemas in
 * `apps/api/src/modules/tenant/users/tenant-users.validation.ts` so the form can
 * give immediate feedback without a round-trip. The field-level error keys line
 * up with the form value keys (`displayName`, `email`, `phone`, `roleCode`,
 * `branchIds`, `initialPin`) so the UI can render them next to the matching
 * input.
 */

const ROLE_CODES = ["owner", "manager", "cashier"] as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PIN_PATTERN = /^\d{6}$/;

type CreateTenantUserErrors = Partial<
  Record<keyof CreateTenantUserRequest, string>
>;

type ValidationResult<TData> =
  | { ok: true; data: TData }
  | { ok: false; errors: CreateTenantUserErrors };

function dedupeBranchIds(branchIds: string[]): string[] {
  return [...new Set(branchIds)];
}

/**
 * Validate the create-member form. `displayName` and `initialPin` are required,
 * `roleCode` must be one of the supported tenant roles, optional `email`/
 * `phone` are checked for shape when provided, and every `branchId` must be a
 * valid 26-char ULID.
 */
export function validateCreateTenantUserForm(
  input: CreateTenantUserRequest,
): ValidationResult<CreateTenantUserRequest> {
  const errors: CreateTenantUserErrors = {};
  const displayName = input.displayName.trim();
  const email = input.email?.trim() ?? "";
  const phone = input.phone?.trim() ?? "";
  const branchIds = dedupeBranchIds(input.branchIds ?? []);

  if (!displayName) {
    errors.displayName = "Display name is required.";
  } else if (displayName.length > 120) {
    errors.displayName = "Display name must be 120 characters or fewer.";
  }

  if (email && email.length > 320) {
    errors.email = "Email must be 320 characters or fewer.";
  } else if (email && !EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (phone && (phone.length < 3 || phone.length > 32)) {
    errors.phone = "Phone must be 3–32 characters.";
  }

  if (!ROLE_CODES.includes(input.roleCode)) {
    errors.roleCode = "Choose a supported role.";
  }

  const invalidBranches = branchIds.filter((id) => !isUlid(id));

  if (invalidBranches.length > 0) {
    errors.branchIds = "One or more selected branches are invalid.";
  }

  if (!PIN_PATTERN.test(input.initialPin)) {
    errors.initialPin = "PIN must be exactly 6 digits.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      displayName,
      email: email || undefined,
      phone: phone || undefined,
      roleCode: input.roleCode,
      branchIds: branchIds.length > 0 ? branchIds : undefined,
      initialPin: input.initialPin,
    },
  };
}

/**
 * Validate the edit-member form. All fields are optional, but the backend
 * rejects an empty update, so at least one field must be present. The same
 * field-level rules as the create form apply when a value is provided.
 */
export function validateUpdateTenantUserForm(
  input: UpdateTenantUserRequest,
): ValidationResult<UpdateTenantUserRequest> {
  const errors: CreateTenantUserErrors = {};

  if (input.displayName !== undefined) {
    const displayName = input.displayName.trim();

    if (!displayName) {
      errors.displayName = "Display name cannot be empty.";
    } else if (displayName.length > 120) {
      errors.displayName = "Display name must be 120 characters or fewer.";
    }
  }

  if (input.phone !== undefined && input.phone !== null) {
    const phone = input.phone.trim();

    if (phone.length < 3 || phone.length > 32) {
      errors.phone = "Phone must be 3–32 characters.";
    }
  }

  if (input.roleCode !== undefined && !ROLE_CODES.includes(input.roleCode)) {
    errors.roleCode = "Choose a supported role.";
  }

  if (input.branchIds !== undefined) {
    const invalidBranches = input.branchIds.filter((id) => !isUlid(id));

    if (invalidBranches.length > 0) {
      errors.branchIds = "One or more selected branches are invalid.";
    }
  }

  const hasField = Object.values(input).some((value) => value !== undefined);

  if (!hasField && Object.keys(errors).length === 0) {
    return {
      ok: false,
      errors: { displayName: "Update at least one field." },
    };
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const data: UpdateTenantUserRequest = {};

  if (input.displayName !== undefined) {
    data.displayName = input.displayName.trim();
  }

  if (input.phone !== undefined) {
    data.phone = input.phone ? input.phone.trim() : null;
  }

  if (input.roleCode !== undefined) {
    data.roleCode = input.roleCode;
  }

  if (input.branchIds !== undefined) {
    data.branchIds = dedupeBranchIds(input.branchIds);
  }

  return { ok: true, data };
}
