import type { PaymentConfig } from "./payment.types.js";

/**
 * Development-only fallback secret.
 *
 * The mock gateway's webhook route is mounted before the auth middleware, so
 * this HMAC secret is the only thing standing between a stranger and
 * `POST /mobile/payment/webhooks/mock` marking any order paid. A hardcoded
 * value in a source tree is not a secret, so production must configure its own
 * — see `resolveMockSecret`.
 */
const DEVELOPMENT_MOCK_SECRET = "cleanhub-mock-payment-secret";

function readGateway(value: string | undefined): PaymentConfig["gateway"] {
  // "mock" is currently the only implemented gateway; an unrecognised value
  // must not silently select something else once real gateways are added.
  if (value && value !== "mock") {
    throw new Error(
      `Unsupported PAYMENT_GATEWAY "${value}". The only supported gateway is "mock".`,
    );
  }

  return "mock";
}

function resolveMockSecret(env: NodeJS.ProcessEnv): string {
  const configured = env.PAYMENT_MOCK_SECRET?.trim();
  if (configured) {
    return configured;
  }

  if (env.NODE_ENV === "production") {
    throw new Error(
      "PAYMENT_MOCK_SECRET is required in production: the payment webhook is unauthenticated and verified by this HMAC secret alone.",
    );
  }

  return DEVELOPMENT_MOCK_SECRET;
}

export function loadPaymentConfig(
  env: NodeJS.ProcessEnv = process.env,
): PaymentConfig {
  return {
    gateway: readGateway(env.PAYMENT_GATEWAY),
    mockSecret: resolveMockSecret(env),
    mockPaymentBaseUrl:
      env.PAYMENT_MOCK_PAYMENT_BASE_URL ??
      env.NEXT_PUBLIC_MOBILE_WEB_URL ??
      "http://localhost:3002",
  };
}
