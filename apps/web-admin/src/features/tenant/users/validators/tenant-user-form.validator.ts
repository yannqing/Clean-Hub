import { PIN_DIGIT_PATTERN } from "@cleanhub/domain/pin";
import { isUlid } from "@cleanhub/id";

import type { CreateTenantUserRequest } from "@cleanhub/api-client";

export function validateCreateTenantUserForm(input: CreateTenantUserRequest) {
  const errors: Partial<Record<keyof CreateTenantUserRequest, string>> = {};
  if (!input.displayName.trim()) errors.displayName = "Display name is required.";
  if (!isUlid(input.branchId)) errors.branchId = "Choose a branch.";
  if (!PIN_DIGIT_PATTERN.test(input.pin)) errors.pin = "PIN must be exactly 6 digits.";
  if (input.roleCode === "manager") {
    if (!input.email?.trim()) errors.email = "Manager email is required.";
    if (!input.password) errors.password = "Manager password is required.";
  }
  return Object.keys(errors).length > 0
    ? ({ ok: false as const, errors })
    : ({ ok: true as const, data: input });
}
