import { webAdminApi } from "@/lib/api-client";

import type { ServiceFormValues } from "../types";
import { validateServiceForm } from "../validators";

export async function createServiceAction(input: ServiceFormValues) {
  const validation = validateServiceForm(input);

  if (!validation.ok) {
    return validation;
  }

  const service = await webAdminApi.tenant.services.create(validation.data);

  return {
    ok: true as const,
    data: service,
  };
}
