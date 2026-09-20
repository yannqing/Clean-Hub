import { randomBytes } from "node:crypto";

// Generates a strong, policy-compliant temporary password from a CSPRNG. The
// character classes are pulled from cryptographically random bytes and then
// shuffled, guaranteeing at least one lowercase letter, one uppercase letter,
// one digit, and one symbol so it passes `assertPasswordMeetsPolicy` for any
// policy where those flags are required. 24 chars comfortably exceeds the
// longest plausible minimum length.
//
// Shared by every operator-initiated password reset -- SaaS users and tenant
// users alike -- so one review of this generator covers them all.
const TEMP_PASSWORD_LOWER = "abcdefghijkmnpqrstuvwxyz";
const TEMP_PASSWORD_UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const TEMP_PASSWORD_DIGITS = "23456789";
const TEMP_PASSWORD_SYMBOLS = "!@#$%^&*-_=+";

export function generateTemporaryPassword(): string {
  const classes = [
    TEMP_PASSWORD_LOWER,
    TEMP_PASSWORD_UPPER,
    TEMP_PASSWORD_DIGITS,
    TEMP_PASSWORD_SYMBOLS,
  ];
  const all = classes.join("");
  const pick = (alphabet: string): string => {
    const index = randomBytes(4).readUInt32BE(0) % alphabet.length;

    return alphabet[index];
  };

  // Guarantee at least one character from each required class, then fill the
  // rest from the full alphabet to reach 24 characters.
  const chars = [
    pick(TEMP_PASSWORD_LOWER),
    pick(TEMP_PASSWORD_UPPER),
    pick(TEMP_PASSWORD_DIGITS),
    pick(TEMP_PASSWORD_SYMBOLS),
  ];
  for (let i = chars.length; i < 24; i += 1) {
    chars.push(pick(all));
  }

  // Fisher–Yates shuffle using a CSPRNG so the guaranteed-class positions are
  // not predictable.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomBytes(4).readUInt32BE(0) % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
