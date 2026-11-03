import { PIN_DIGIT_COUNT, isSixDigitPin } from "@cleanhub/domain/pin";

export type LoginFormValues = {
  pin: string;
};

export type LoginFormField = keyof LoginFormValues;

export type LoginFormFieldErrors = Partial<Record<LoginFormField, string>>;

export const POS_PIN_LENGTH = PIN_DIGIT_COUNT;

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
  } else if (!isSixDigitPin(values.pin)) {
    errors.pin = messages.pinInvalid;
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
