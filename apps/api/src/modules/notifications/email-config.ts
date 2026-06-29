import { normalizeLocale } from "./notification-renderer.js";

export type EmailConfig = {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser?: string;
  smtpPass?: string;
  from: string;
  defaultLocale: string;
  retryBaseSeconds: number;
  retryMaxSeconds: number;
};

function readPositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(value: string | undefined, fallback = false): boolean {
  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function loadEmailConfig(
  env: NodeJS.ProcessEnv = process.env,
): EmailConfig {
  const smtpHost = env.EMAIL_SMTP_HOST ?? env.SMTP_HOST;

  if (!smtpHost) {
    throw new Error("EMAIL_SMTP_HOST is required to send email notifications.");
  }

  const smtpUser = env.EMAIL_SMTP_USER ?? env.SMTP_USER;
  const smtpPass = env.EMAIL_SMTP_PASS ?? env.SMTP_PASS;

  return {
    smtpHost,
    smtpPort: readPositiveInteger(env.EMAIL_SMTP_PORT ?? env.SMTP_PORT, 1025),
    smtpSecure: readBoolean(env.EMAIL_SMTP_SECURE ?? env.SMTP_SECURE),
    smtpUser: smtpUser || undefined,
    smtpPass: smtpPass || undefined,
    from: env.EMAIL_FROM ?? "CleanHub <no-reply@cleanhub.local>",
    defaultLocale:
      normalizeLocale(env.EMAIL_DEFAULT_LOCALE) ??
      normalizeLocale(env.DEFAULT_LOCALE) ??
      "en",
    retryBaseSeconds: readPositiveInteger(
      env.EMAIL_DELIVERY_RETRY_BASE_SECONDS,
      60,
    ),
    retryMaxSeconds: readPositiveInteger(
      env.EMAIL_DELIVERY_RETRY_MAX_SECONDS,
      3600,
    ),
  };
}
