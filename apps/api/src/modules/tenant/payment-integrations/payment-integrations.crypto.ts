import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { TenantPaymentIntegrationError } from "./payment-integrations.errors.js";
import type {
  TenantPaymentCredentials,
  TenantPaymentProvider,
} from "./payment-integrations.types.js";

const CIPHER = "aes-256-gcm";
const CREDENTIAL_FORMAT_VERSION = "v1";
const DEVELOPMENT_KEY_SEED =
  "cleanhub-development-only-payment-credential-encryption-key";

function decodeConfiguredKey(value: string): Buffer {
  const trimmed = value.trim();
  if (/^[a-f\d]{64}$/i.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  const decoded = Buffer.from(trimmed, "base64");
  if (decoded.length === 32) return decoded;

  return createHash("sha256").update(trimmed).digest();
}

function resolveEncryptionKey(env: NodeJS.ProcessEnv): Buffer {
  const configured = env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY;
  if (configured?.trim()) return decodeConfiguredKey(configured);

  if (env.NODE_ENV === "production") {
    throw new TenantPaymentIntegrationError(
      "PAYMENT_CREDENTIAL_ENCRYPTION_NOT_CONFIGURED",
      "Payment credential encryption is not configured on the server.",
      503,
    );
  }

  return createHash("sha256").update(DEVELOPMENT_KEY_SEED).digest();
}

function additionalData(
  tenantId: string,
  provider: TenantPaymentProvider,
): Buffer {
  return Buffer.from(`${tenantId}:${provider}`, "utf8");
}

export function encryptPaymentCredentials(
  tenantId: string,
  credentials: TenantPaymentCredentials,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(CIPHER, resolveEncryptionKey(env), iv);
  cipher.setAAD(additionalData(tenantId, credentials.provider));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(credentials), "utf8"),
    cipher.final(),
  ]);
  const authenticationTag = cipher.getAuthTag();

  return [
    CREDENTIAL_FORMAT_VERSION,
    iv.toString("base64url"),
    authenticationTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptPaymentCredentials(
  tenantId: string,
  provider: TenantPaymentProvider,
  encryptedCredentials: string,
  env: NodeJS.ProcessEnv = process.env,
): TenantPaymentCredentials {
  const [version, ivValue, authenticationTagValue, encryptedValue] =
    encryptedCredentials.split(".");
  if (
    version !== CREDENTIAL_FORMAT_VERSION ||
    !ivValue ||
    !authenticationTagValue ||
    !encryptedValue
  ) {
    throw invalidStoredCredentialError();
  }

  try {
    const decipher = createDecipheriv(
      CIPHER,
      resolveEncryptionKey(env),
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAAD(additionalData(tenantId, provider));
    decipher.setAuthTag(Buffer.from(authenticationTagValue, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const parsed = JSON.parse(decrypted) as TenantPaymentCredentials;

    if (parsed.provider !== provider) throw invalidStoredCredentialError();
    return parsed;
  } catch (error) {
    if (error instanceof TenantPaymentIntegrationError) throw error;
    throw invalidStoredCredentialError();
  }
}

function invalidStoredCredentialError(): TenantPaymentIntegrationError {
  return new TenantPaymentIntegrationError(
    "PAYMENT_CREDENTIAL_DECRYPTION_FAILED",
    "Stored payment credentials could not be decrypted. Save and verify the credentials again.",
    503,
  );
}
