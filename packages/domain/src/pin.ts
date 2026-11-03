/** The single, fixed PIN format used throughout CleanHub. */
export const PIN_DIGIT_COUNT = 6;

/** Matches a PIN only when it contains exactly six ASCII digits. */
export const PIN_DIGIT_PATTERN = /^\d{6}$/;

export function isSixDigitPin(pin: string): boolean {
  return PIN_DIGIT_PATTERN.test(pin);
}
