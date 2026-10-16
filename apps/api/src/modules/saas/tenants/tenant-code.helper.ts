import { randomInt } from "node:crypto";

const TENANT_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const TENANT_CODE_LENGTH = 10;

export function generateTenantCode(): string {
  let code: string;

  do {
    code = Array.from({ length: TENANT_CODE_LENGTH }, () =>
      TENANT_CODE_ALPHABET.charAt(randomInt(TENANT_CODE_ALPHABET.length)),
    ).join("");
  } while (!/[A-Z]/.test(code) || !/[0-9]/.test(code));

  return code;
}
