export type LoginMode = "platform" | "tenant";

export type LoginFormValues = {
  loginMode: LoginMode;
  identifier: string;
  password: string;
  tenantCode: string;
};

export type LoginFormField = keyof LoginFormValues;

export type LoginFormFieldErrors = Partial<Record<LoginFormField, string>>;

export function validateLoginForm(
  values: LoginFormValues,
): LoginFormFieldErrors | null {
  const errors: LoginFormFieldErrors = {};

  if (!values.identifier.trim()) {
    errors.identifier = "Email or phone is required.";
  }

  if (!values.password) {
    errors.password = "Password is required.";
  }

  if (values.loginMode === "tenant" && !values.tenantCode.trim()) {
    errors.tenantCode = "Pressing code is required for store login.";
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
