"use server";

import type {
  ConfigureOrangeMoneyPaymentIntegrationRequest,
  ConfigureWavePaymentIntegrationRequest,
  TenantPaymentIntegrationSummary,
  TenantPaymentProvider,
} from "@cleanhub/api-client";
import { revalidatePath } from "next/cache";

import { getAuthSessionQuery } from "@/features/auth/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { webAdminApi } from "@/lib/api-client";

type PaymentIntegrationActionResult =
  | { ok: true; data: TenantPaymentIntegrationSummary }
  | { ok: false; message: string };

async function ownerRequestOptions() {
  const options = await getTenantServerApiRequestOptions();
  const authContext = await getAuthSessionQuery(options);
  if (!authContext || authContext.role !== "owner" || !authContext.tenantId) {
    throw new Error("Only the tenant owner can manage payment integrations.");
  }
  return options;
}

function failure(error: unknown): PaymentIntegrationActionResult {
  return {
    ok: false,
    message:
      error instanceof Error
        ? error.message
        : "Payment integration request failed.",
  };
}

function revalidatePaymentConsumers(): void {
  revalidatePath("/tenant/system/settings/payments");
  revalidatePath("/tenant/system/settings/point-of-sale");
  revalidatePath("/tenant/point-of-sale/settings");
  revalidatePath("/tenant", "layout");
}

export async function configureWavePaymentIntegrationAction(
  input: ConfigureWavePaymentIntegrationRequest,
): Promise<PaymentIntegrationActionResult> {
  try {
    const data = await webAdminApi.tenant.paymentIntegrations.configureWave(
      input,
      await ownerRequestOptions(),
    );
    revalidatePaymentConsumers();
    return { ok: true, data };
  } catch (error) {
    return failure(error);
  }
}

export async function configureOrangeMoneyPaymentIntegrationAction(
  input: ConfigureOrangeMoneyPaymentIntegrationRequest,
): Promise<PaymentIntegrationActionResult> {
  try {
    const data =
      await webAdminApi.tenant.paymentIntegrations.configureOrangeMoney(
        input,
        await ownerRequestOptions(),
      );
    revalidatePaymentConsumers();
    return { ok: true, data };
  } catch (error) {
    return failure(error);
  }
}

export async function verifyPaymentIntegrationAction(
  provider: TenantPaymentProvider,
): Promise<PaymentIntegrationActionResult> {
  try {
    const data = await webAdminApi.tenant.paymentIntegrations.verify(
      provider,
      await ownerRequestOptions(),
    );
    revalidatePaymentConsumers();
    return { ok: true, data };
  } catch (error) {
    return failure(error);
  }
}

export async function updatePaymentIntegrationAvailabilityAction(
  provider: TenantPaymentProvider,
  posEnabled: boolean,
): Promise<PaymentIntegrationActionResult> {
  try {
    const data = await webAdminApi.tenant.paymentIntegrations.update(
      provider,
      { posEnabled },
      await ownerRequestOptions(),
    );
    revalidatePaymentConsumers();
    return { ok: true, data };
  } catch (error) {
    return failure(error);
  }
}

export async function removePaymentIntegrationAction(
  provider: TenantPaymentProvider,
): Promise<
  { ok: true; provider: TenantPaymentProvider } | { ok: false; message: string }
> {
  try {
    await webAdminApi.tenant.paymentIntegrations.remove(
      provider,
      await ownerRequestOptions(),
    );
    revalidatePaymentConsumers();
    return { ok: true, provider };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Payment integration request failed.",
    };
  }
}
