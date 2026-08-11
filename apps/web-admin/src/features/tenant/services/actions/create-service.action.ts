import { webAdminApi } from "@/lib/api-client";

import type {
  ServiceFormErrors,
  ServiceFormValues,
  ServiceDetail,
} from "../types";
import { validateServiceForm } from "../validators";
import {
  getServiceActionError,
  type ServiceActionError,
} from "./service-action-errors";

export type CreateServiceActionResult =
  | { ok: true; data: ServiceDetail }
  | ({ ok: false } & ServiceActionError & { errors: ServiceFormErrors });

export async function createServiceAction(
  input: ServiceFormValues,
): Promise<CreateServiceActionResult> {
  const validation = validateServiceForm(input);

  if (!validation.ok) {
    return {
      ok: false,
      message: "Check the service form.",
      errors: validation.errors,
    };
  }

  try {
    const service = await webAdminApi.tenant.services.create(validation.data);

    return {
      ok: true,
      data: service,
    };
  } catch (error) {
    const actionError = getServiceActionError(
      error,
      "Service could not be created.",
    );

    return {
      ok: false,
      ...actionError,
    };
  }
}
