export type LoginFormValues = {
  pin: string;
};

export type LoginFormField = keyof LoginFormValues;

export type LoginFormFieldErrors = Partial<Record<LoginFormField, string>>;

export const POS_PIN_MIN_LENGTH = 4;
export const POS_PIN_MAX_LENGTH = 8;

type LoginFormValidationMessages = {
  pinRequired: string;
  pinInvalid: string;
};

export function validateLoginForm(
  values: LoginFormValues,
  messages: LoginFormValidationMessages,
): LoginFormFieldErrors | null {
  const errors: LoginFormFieldErrors = {};

  if (!values.pin) {
    errors.pin = messages.pinRequired;
  } else if (!/^\d{4,8}$/.test(values.pin)) {
    errors.pin = messages.pinInvalid;
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
