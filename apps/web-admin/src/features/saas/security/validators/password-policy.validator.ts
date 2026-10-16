import { securitySettingsDefaultValues } from "../constants";

export type PasswordPolicyRules = {
  passwordMinLength: number;
  passwordRequiresNumber: boolean;
  passwordRequiresSymbol: boolean;
};

export function validatePasswordAgainstPolicy(
  password: string,
  policy: PasswordPolicyRules = securitySettingsDefaultValues,
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
