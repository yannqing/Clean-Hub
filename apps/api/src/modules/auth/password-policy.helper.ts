import { AuthError } from "./auth.errors.js";
import type { EffectiveSecurityPolicy } from "../saas-security/security-policy.js";

export function validatePasswordAgainstPolicy(
  password: string,
  policy: EffectiveSecurityPolicy,
): string | null {
  if (password.length < policy.passwordMinLength) {
    return `Password must be at least ${policy.passwordMinLength} characters.`;
  }

  if (password.length > 128) {
    return "Password must be 128 characters or fewer.";
  }

  if (policy.passwordRequiresNumber && !/\d/.test(password)) {
    return "Password must contain at least one number.";
  }

  if (policy.passwordRequiresSymbol && !/[^A-Za-z0-9]/.test(password)) {
    return "Password must contain at least one symbol.";
  }

  return null;
}

export function assertPasswordMeetsPolicy(
  password: string,
  policy: EffectiveSecurityPolicy,
): void {
  const message = validatePasswordAgainstPolicy(password, policy);

  if (message) {
    throw new AuthError("PASSWORD_POLICY_VIOLATION", message);
  }
}
