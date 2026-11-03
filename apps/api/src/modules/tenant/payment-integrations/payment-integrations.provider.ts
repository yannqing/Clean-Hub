import { createHmac } from "node:crypto";

import type {
  PaymentCredentialVerificationResult,
  TenantPaymentCredentials,
  WavePaymentCredentials,
} from "./payment-integrations.types.js";

const PROVIDER_TIMEOUT_MS = 10_000;

type FetchImplementation = typeof fetch;

async function requestWithTimeout(
  fetchImplementation: FetchImplementation,
  input: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    return await fetchImplementation(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function waveVerificationHeaders(
  credentials: WavePaymentCredentials,
): HeadersInit {
  const headers: Record<string, string> = {
    accept: "application/json",
    authorization: `Bearer ${credentials.apiKey}`,
  };

  if (credentials.signingSecret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", credentials.signingSecret)
      .update(timestamp)
      .digest("hex");
    headers["wave-signature"] = `t=${timestamp},v1=${signature}`;
  }

  return headers;
}

async function verifyWaveCredentials(
  credentials: WavePaymentCredentials,
  fetchImplementation: FetchImplementation,
): Promise<PaymentCredentialVerificationResult> {
  const reference = `cleanhub-credential-check-${Date.now()}`;
  const response = await requestWithTimeout(
    fetchImplementation,
    `https://api.wave.com/v1/checkout/sessions/search?client_reference=${encodeURIComponent(reference)}`,
    { headers: waveVerificationHeaders(credentials), method: "GET" },
  );

  return response.ok
    ? {
        valid: true,
        message: "Wave Checkout API credentials were verified.",
      }
    : {
        valid: false,
        message: `Wave rejected the credentials (HTTP ${response.status}). Confirm that this API key can access the Checkout API${credentials.signingSecret ? " and that the signing secret matches" : ""}.`,
      };
}

async function verifyOrangeMoneyCredentials(
  credentials: Extract<TenantPaymentCredentials, { provider: "orange_money" }>,
  fetchImplementation: FetchImplementation,
): Promise<PaymentCredentialVerificationResult> {
  const authorization = Buffer.from(
    `${credentials.clientId}:${credentials.clientSecret}`,
    "utf8",
  ).toString("base64");
  const response = await requestWithTimeout(
    fetchImplementation,
    "https://api.orange.com/oauth/v3/token",
    {
      body: "grant_type=client_credentials",
      headers: {
        accept: "application/json",
        authorization: `Basic ${authorization}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    return {
      valid: false,
      message: `Orange rejected the API credentials (HTTP ${response.status}). Confirm the Client ID and Client Secret.`,
    };
  }

  const body = (await response.json().catch(() => null)) as {
    access_token?: unknown;
  } | null;
  return typeof body?.access_token === "string" && body.access_token.length > 0
    ? {
        valid: true,
        message: "Orange OAuth credentials were verified.",
      }
    : {
        valid: false,
        message: "Orange did not return an access token for these credentials.",
      };
}

export async function verifyPaymentCredentials(
  credentials: TenantPaymentCredentials,
  fetchImplementation: FetchImplementation = fetch,
): Promise<PaymentCredentialVerificationResult> {
  try {
    return credentials.provider === "wave"
      ? await verifyWaveCredentials(credentials, fetchImplementation)
      : await verifyOrangeMoneyCredentials(credentials, fetchImplementation);
  } catch (error) {
    return {
      valid: false,
      message:
        error instanceof Error && error.name === "AbortError"
          ? "The payment provider verification timed out."
          : "The payment provider could not be reached. Try again later.",
    };
  }
}
