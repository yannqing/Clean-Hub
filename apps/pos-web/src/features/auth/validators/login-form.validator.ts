export type LoginFormValues = {
  identifier: string;
  password: string;
};

export type LoginFormField = keyof LoginFormValues;

export type LoginFormFieldErrors = Partial<Record<LoginFormField, string>>;

type LoginFormValidationMessages = {
  identifierRequired: string;
  passwordRequired: string;
};

export function validateLoginForm(
  values: LoginFormValues,
  messages: LoginFormValidationMessages,
): LoginFormFieldErrors | null {
  const errors: LoginFormFieldErrors = {};

  if (!values.identifier.trim()) {
    errors.identifier = messages.identifierRequired;
  }

  if (!values.password) {
    errors.password = messages.passwordRequired;
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
