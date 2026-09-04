import { z } from "zod";

export const tenantPaymentProviderSchema = z.enum(["wave", "orange_money"]);

export const configureWavePaymentIntegrationBodySchema = z
  .object({
    apiKey: z.string().trim().min(12).max(500),
    signingSecret: z.string().trim().min(12).max(500).optional(),
    posEnabled: z.boolean().optional(),
  })
  .strict();

export const configureOrangeMoneyPaymentIntegrationBodySchema = z
  .object({
    clientId: z.string().trim().min(3).max(500),
    clientSecret: z.string().trim().min(8).max(500),
    merchantKey: z.string().trim().min(3).max(500),
    posEnabled: z.boolean().optional(),
  })
  .strict();

export const updatePaymentIntegrationBodySchema = z
  .object({ posEnabled: z.boolean() })
  .strict();
