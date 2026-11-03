export type PushConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  tokenUri: string;
};

export type PushRetrySettings = {
  retryBaseSeconds: number;
  retryMaxSeconds: number;
};

const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";

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

export function isPushConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(
    env.FCM_PROJECT_ID && env.FCM_CLIENT_EMAIL && env.FCM_PRIVATE_KEY,
  );
}

/**
 * Loads Firebase Cloud Messaging service-account credentials from env.
 *
 * Throws when credentials are missing so a delivery attempt fails (and is
 * retried later) instead of crashing the API process at startup. Callers must
 * only invoke this lazily, right before sending.
 */
export function loadPushConfig(env: NodeJS.ProcessEnv = process.env): PushConfig {
  const projectId = env.FCM_PROJECT_ID;
  const clientEmail = env.FCM_CLIENT_EMAIL;
  const privateKey = env.FCM_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Push notifications are not configured. Set FCM_PROJECT_ID, FCM_CLIENT_EMAIL and FCM_PRIVATE_KEY.",
    );
  }

  return {
    projectId,
    clientEmail,
    // .env files usually store the PEM key on one line with literal "\n".
    privateKey: privateKey.replace(/\\n/g, "\n"),
    tokenUri: env.FCM_TOKEN_URI ?? DEFAULT_TOKEN_URI,
  };
}

export function loadPushRetrySettings(
  env: NodeJS.ProcessEnv = process.env,
): PushRetrySettings {
  return {
    retryBaseSeconds: readPositiveInteger(
      env.PUSH_DELIVERY_RETRY_BASE_SECONDS,
      60,
    ),
    retryMaxSeconds: readPositiveInteger(
      env.PUSH_DELIVERY_RETRY_MAX_SECONDS,
      3600,
    ),
  };
}
