import { webAdminApi } from "@/lib/api-client";

import type { ServiceFormValues, ServiceStatus } from "../types";
import { validateServiceUpdateForm } from "../validators";

export async function updateServiceAction(
  serviceId: string,
  input: ServiceFormValues,
) {
  const validation = validateServiceUpdateForm(input);

  if (!validation.ok) {
    return validation;
  }

  const service = await webAdminApi.tenant.services.update(
    serviceId,
    validation.data,
  );

  return {
    ok: true as const,
    data: service,
  };
}

export async function deleteServiceAction(serviceId: string) {
  await webAdminApi.tenant.services.remove(serviceId);

  return {
    ok: true as const,
  };
}

export async function updateServiceStatusAction(
  serviceId: string,
  status: ServiceStatus,
) {
  const service = await webAdminApi.tenant.services.updateStatus(serviceId, {
    status,
  });

  return {
    ok: true as const,
    data: service,
  };
}
