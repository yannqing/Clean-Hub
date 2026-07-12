import { createSign } from "node:crypto";

import type {
  ChannelAdapter,
  ChannelSendInput,
  ChannelSendResult,
} from "./channel-adapter.js";
import type { PushConfig } from "./push-config.js";

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const ACCESS_TOKEN_EXPIRY_MARGIN_MS = 60_000;

/** FCM v1 error codes that mean the device token is permanently unusable. */
const INVALID_TOKEN_ERROR_CODES = new Set(["UNREGISTERED", "INVALID_ARGUMENT"]);

export class PushSendError extends Error {
  constructor(
    message: string,
    readonly fcmErrorCode: string | null,
    readonly httpStatus: number | null,
  ) {
    super(message);
    this.name = "PushSendError";
  }

  get isTokenInvalid(): boolean {
    return (
      this.fcmErrorCode !== null &&
      INVALID_TOKEN_ERROR_CODES.has(this.fcmErrorCode)
    );
  }
}

type CachedAccessToken = {
  accessToken: string;
  expiresAtMs: number;
};

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function base64UrlEncodeJson(value: Record<string, unknown>): string {
  return base64UrlEncode(JSON.stringify(value));
}

type FcmErrorBody = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: { "@type"?: string; errorCode?: string }[];
  };
};

async function toPushSendError(response: Response): Promise<PushSendError> {
  let body: FcmErrorBody = {};
  let rawText = "";

  try {
    rawText = await response.text();
    body = JSON.parse(rawText) as FcmErrorBody;
  } catch {
    // Keep the raw text for the error message below.
  }

  const detailErrorCode = body.error?.details?.find(
    (detail) => typeof detail.errorCode === "string",
  )?.errorCode;
  const fcmErrorCode = detailErrorCode ?? body.error?.status ?? null;
  const message =
    body.error?.message ??
    (rawText ? rawText.slice(0, 300) : "FCM send request failed.");

  return new PushSendError(
    `FCM send failed (${response.status}${fcmErrorCode ? ` ${fcmErrorCode}` : ""}): ${message}`,
    fcmErrorCode,
    response.status,
  );
}

/**
 * FCM HTTP v1 channel adapter.
 *
 * OAuth2 access tokens are minted locally by signing a service-account JWT
 * (RS256 via node:crypto) and exchanging it at the Google token endpoint --
 * no firebase-admin dependency. Access tokens are cached until shortly before
 * expiry.
 */
export class PushAdapter implements ChannelAdapter {
  readonly channel = "push" as const;
  private cachedToken: CachedAccessToken | null = null;
  private tokenRequest: Promise<string> | null = null;

  constructor(
    private readonly config: PushConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(input: ChannelSendInput): Promise<ChannelSendResult> {
    const accessToken = await this.getAccessToken();
    const response = await this.fetchImpl(
      `https://fcm.googleapis.com/v1/projects/${this.config.projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: input.to,
            notification: {
              title: input.subject,
              body: input.text,
            },
            ...(input.data && Object.keys(input.data).length > 0
              ? { data: input.data }
              : {}),
          },
        }),
      },
    );

    if (!response.ok) {
      throw await toPushSendError(response);
    }

    const body = (await response.json().catch(() => ({}))) as {
      name?: string;
    };

    return {
      externalId: body.name ?? `fcm:${input.deliveryId}:${Date.now()}`,
      status: "sent",
    };
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();

    if (
      this.cachedToken &&
      this.cachedToken.expiresAtMs - ACCESS_TOKEN_EXPIRY_MARGIN_MS > now
    ) {
      return this.cachedToken.accessToken;
    }

    // Concurrent sends share a single token exchange.
    this.tokenRequest ??= this.requestAccessToken(now).finally(() => {
      this.tokenRequest = null;
    });

    return this.tokenRequest;
  }

  private async requestAccessToken(nowMs: number): Promise<string> {
    const response = await this.fetchImpl(this.config.tokenUri, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: this.buildServiceAccountJwt(nowMs),
      }).toString(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");

      throw new PushSendError(
        `FCM OAuth token request failed (${response.status}): ${text.slice(0, 300)}`,
        null,
        response.status,
      );
    }

    const body = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };

    if (!body.access_token) {
      throw new PushSendError(
        "FCM OAuth token response is missing access_token.",
        null,
        null,
      );
    }

    this.cachedToken = {
      accessToken: body.access_token,
      expiresAtMs: nowMs + (body.expires_in ?? 3600) * 1000,
    };

    return body.access_token;
  }

  private buildServiceAccountJwt(nowMs: number): string {
    const issuedAt = Math.floor(nowMs / 1000);
    const header = base64UrlEncodeJson({ alg: "RS256", typ: "JWT" });
    const payload = base64UrlEncodeJson({
      iss: this.config.clientEmail,
      scope: FCM_SCOPE,
      aud: this.config.tokenUri,
      iat: issuedAt,
      exp: issuedAt + 3600,
    });
    const signingInput = `${header}.${payload}`;
    const signature = createSign("RSA-SHA256")
      .update(signingInput)
      .sign(this.config.privateKey);

    return `${signingInput}.${base64UrlEncode(signature)}`;
  }
}
