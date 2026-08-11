import { webAdminApi } from "@/lib/api-client";

import type {
  ServiceFormErrors,
  ServiceFormValues,
  ServiceDetail,
  ServiceStatus,
  ServiceSummary,
} from "../types";
import { validateServiceUpdateForm } from "../validators";
import {
  getServiceActionError,
  type ServiceActionError,
} from "./service-action-errors";

export type UpdateServiceActionResult =
  | { ok: true; data: ServiceDetail }
  | ({ ok: false } & ServiceActionError & { errors: ServiceFormErrors });

export async function updateServiceAction(
  serviceId: string,
  input: ServiceFormValues,
): Promise<UpdateServiceActionResult> {
  const validation = validateServiceUpdateForm(input);

  if (!validation.ok) {
    return {
      ok: false,
      message: "Check the service form.",
      errors: validation.errors,
    };
  }

  try {
    const service = await webAdminApi.tenant.services.update(
      serviceId,
      validation.data,
    );

    return {
      ok: true,
      data: service,
    };
  } catch (error) {
    const actionError = getServiceActionError(
      error,
      "Service could not be updated.",
    );

    return {
      ok: false,
      ...actionError,
    };
  }
}

export type UpdateServiceStatusActionResult =
  | { ok: true; data: ServiceSummary }
  | ({ ok: false } & ServiceActionError);

export async function updateServiceStatusAction(
  serviceId: string,
  status: ServiceStatus,
  version: number,
): Promise<UpdateServiceStatusActionResult> {
  try {
    const service = await webAdminApi.tenant.services.updateStatus(serviceId, {
      status,
      version,
    });

    return {
      ok: true,
      data: service,
    };
  } catch (error) {
    return {
      ok: false,
      ...getServiceActionError(error, "Service status could not be updated."),
    };
  }
}

export type DeleteServiceActionResult =
  | { ok: true }
  | ({ ok: false } & ServiceActionError);

export async function deleteServiceAction(
  serviceId: string,
): Promise<DeleteServiceActionResult> {
  try {
    await webAdminApi.tenant.services.remove(serviceId);

    return {
      ok: true,
    };
  } catch (error) {
    return {
      ok: false,
      ...getServiceActionError(error, "Service could not be deleted."),
    };
  }
}
