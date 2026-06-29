import type { PaymentConfig } from "./payment.types.js";

function readGateway(value: string | undefined): PaymentConfig["gateway"] {
  return value === "mock" || !value ? "mock" : "mock";
}

export function loadPaymentConfig(
  env: NodeJS.ProcessEnv = process.env,
): PaymentConfig {
  return {
    gateway: readGateway(env.PAYMENT_GATEWAY),
    currency: env.PAYMENT_CURRENCY ?? "XOF",
    mockSecret: env.PAYMENT_MOCK_SECRET ?? "cleanhub-mock-payment-secret",
    mockPaymentBaseUrl:
      env.PAYMENT_MOCK_PAYMENT_BASE_URL ??
      env.NEXT_PUBLIC_MOBILE_WEB_URL ??
      "http://localhost:3002",
  };
}
