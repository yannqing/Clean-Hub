import { createId } from "@cleanhub/id";

export type CustomerOtpSender = (input: {
  tenantId: string;
  phone: string;
  code: string;
  locale?: string;
}) => Promise<void>;

/** Shares the platform's provider-neutral SMS contract used for POS receipts. */
export function createCustomerOtpSender(
  env: NodeJS.ProcessEnv,
): CustomerOtpSender | undefined {
  const endpoint = env.SMS_WEBHOOK_URL?.trim();
  if (!endpoint) return undefined;
  const url = new URL(endpoint);
  if (env.NODE_ENV === "production" && url.protocol !== "https:")
    throw new Error("Production SMS_WEBHOOK_URL must use HTTPS.");
  return async (input) => {
    const message =
      input.locale === "zh-CN"
        ? `CleanHub 登录验证码：${input.code}，10 分钟内有效。请勿透露给他人。`
        : input.locale === "en"
          ? `Your CleanHub sign-in code is ${input.code}. It expires in 10 minutes. Do not share it.`
          : `Votre code de connexion CleanHub est ${input.code}. Il expire dans 10 minutes. Ne le partagez pas.`;
    const response = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "content-type": "application/json",
        ...(env.SMS_WEBHOOK_TOKEN
          ? { authorization: `Bearer ${env.SMS_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        idempotencyKey: createId(),
        tenantId: input.tenantId,
        to: input.phone,
        message,
      }),
    });
    if (!response.ok)
      throw new Error(
        "The sign-in code could not be sent. Please try again later or contact the store.",
      );
  };
}
