import { createHash, timingSafeEqual } from "node:crypto";

import { AuthError } from "./auth.errors.js";
import { generateOpaqueToken } from "./token.service.js";

export const POS_TERMINAL_CREDENTIAL_COOKIE_NAME =
  "cleanhub_pos_terminal_credential";

export type EnrolledTerminalCredentialContext = {
  id: string;
  branchId: string | null;
  status: "active" | "inactive" | null;
  credentialDigest: string | null;
};

export function generateTerminalCredential(): string {
  return generateOpaqueToken();
}

export function hashTerminalCredential(credential: string): string {
  return createHash("sha256").update(credential).digest("base64url");
}

export function terminalCredentialMatches(
  credential: string,
  expectedDigest: string,
): boolean {
  const actual = Buffer.from(hashTerminalCredential(credential));
  const expected = Buffer.from(expectedDigest);

  return (
    actual.length === expected.length && timingSafeEqual(actual, expected)
  );
}

export function assertEnrolledTerminalCredential(
  terminal: EnrolledTerminalCredentialContext | null,
  credential: string | undefined,
): asserts terminal is EnrolledTerminalCredentialContext & {
  branchId: string;
  status: "active";
  credentialDigest: string;
} {
  if (!terminal || !terminal.branchId || !terminal.credentialDigest) {
    throw new AuthError(
      "POS_TERMINAL_ENROLLMENT_REQUIRED",
      "This POS terminal must be enrolled before PIN login.",
    );
  }

  if (terminal.status !== "active") {
    throw new AuthError(
      "POS_TERMINAL_DISABLED",
      "This POS terminal is disabled.",
    );
  }

  if (
    !credential ||
    !terminalCredentialMatches(credential, terminal.credentialDigest)
  ) {
    throw new AuthError(
      "POS_TERMINAL_CREDENTIAL_INVALID",
      "This POS terminal credential is invalid or expired.",
    );
  }
}

export function buildPosPinLockKeys(input: {
  tenantId: string;
  terminalId?: string;
  ipAddress?: string;
}): string[] {
  const keys = [
    `pos-pin-network:${input.tenantId}:${input.ipAddress?.trim() || "unknown"}`,
  ];

  if (input.terminalId) {
    keys.unshift(`pos-pin-terminal:${input.tenantId}:${input.terminalId}`);
  }

  return keys;
}

export function createTerminalCredentialCookieHeader(
  credential: string,
  options: { secure?: boolean; maxAgeSeconds?: number } = {},
): string {
  const parts = [
    `${POS_TERMINAL_CREDENTIAL_COOKIE_NAME}=${encodeURIComponent(credential)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${options.maxAgeSeconds ?? 365 * 24 * 60 * 60}`,
  ];

  if (options.secure ?? process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}
