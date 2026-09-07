"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { getAuthSessionQuery } from "@/features/auth/queries";
import { webAdminLocaleCookieName } from "@/i18n";
import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import type {
  TenantDefaultCurrencyFormValues,
  TenantProfileFormValues,
  TenantSettings,
  TenantSettingsFormValues,
} from "../types";
import {
  validateTenantDefaultCurrencyForm,
  validateTenantProfileForm,
  validateTenantSettingsForm,
} from "../validators";

type TenantSettingsActionResult =
  | {
      ok: true;
      data: TenantSettings;
    }
  | {
      ok: false;
      errors: Partial<Record<keyof TenantSettingsFormValues, string>>;
      message: string;
    };

type TenantDefaultCurrencyActionResult =
  | {
      ok: true;
      data: TenantSettings;
    }
  | {
      ok: false;
      errors: Partial<Record<keyof TenantDefaultCurrencyFormValues, string>>;
      message: string;
    };

type TenantProfileActionResult =
  | {
      ok: true;
      data: TenantSettings;
    }
  | {
      ok: false;
      errors: Partial<Record<keyof TenantProfileFormValues, string>>;
      message: string;
    };

const OWNER_ONLY_MESSAGE = "Only tenant owners can update tenant settings.";

function getActionErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Tenant settings could not be updated.";
}

function revalidateTenantCurrencyConsumers(): void {
  revalidatePath("/tenant/system/settings");
  revalidatePath("/tenant/system/settings/pricing");
  revalidatePath("/tenant/services/new");
  revalidatePath("/tenant/products/new");
  revalidatePath("/tenant/branches/new");
  revalidatePath("/tenant/finance");
  revalidatePath("/tenant/point-of-sale");
  revalidatePath("/tenant/reports");
  revalidatePath("/tenant", "layout");
}

export async function updateTenantProfileAction(
  input: TenantProfileFormValues,
): Promise<TenantProfileActionResult> {
  const requestOptions = await getTenantServerApiRequestOptions();
  const authContext = await getAuthSessionQuery(requestOptions);

  if (!authContext || authContext.role !== "owner" || !authContext.tenantId) {
    return {
      ok: false,
      errors: {},
      message: OWNER_ONLY_MESSAGE,
    };
  }

  const validation = validateTenantProfileForm(input);

  if (!validation.ok) {
    return {
      ...validation,
      message: validation.message ?? "Check the tenant details form.",
    };
  }

  try {
    const settings = await webAdminApi.tenant.settings.update(
      validation.data,
      requestOptions,
    );

    revalidatePath("/tenant/system/settings");
    revalidatePath("/tenant", "layout");

    return { ok: true, data: settings };
  } catch (error) {
    return {
      ok: false,
      errors: {},
      message: getActionErrorMessage(error),
    };
  }
}

export async function updateTenantSettingsAction(
  input: TenantSettingsFormValues,
): Promise<TenantSettingsActionResult> {
  const requestOptions = await getTenantServerApiRequestOptions();

  const authContext = await getAuthSessionQuery(requestOptions);

  if (!authContext || authContext.role !== "owner" || !authContext.tenantId) {
    return {
      ok: false,
      errors: {},
      message: OWNER_ONLY_MESSAGE,
    };
  }

  const validation = validateTenantSettingsForm(input);

  if (!validation.ok) {
    return {
      ...validation,
      message: validation.message ?? "Check the tenant settings form.",
    };
  }

  try {
    const settings = await webAdminApi.tenant.settings.update(
      validation.data,
      requestOptions,
    );

    (await cookies()).set(webAdminLocaleCookieName, settings.defaultLanguage, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    });

    revalidatePath("/tenant/system/settings");
    revalidatePath("/tenant/system/preferences");
    revalidatePath("/tenant", "layout");

    return {
      ok: true,
      data: settings,
    };
  } catch (error) {
    return {
      ok: false,
      errors: {},
      message: getActionErrorMessage(error),
    };
  }
}

export async function updateTenantDefaultCurrencyAction(
  input: TenantDefaultCurrencyFormValues,
): Promise<TenantDefaultCurrencyActionResult> {
  const requestOptions = await getTenantServerApiRequestOptions();
  const authContext = await getAuthSessionQuery(requestOptions);

  if (!authContext || authContext.role !== "owner" || !authContext.tenantId) {
    return {
      ok: false,
      errors: {},
      message: OWNER_ONLY_MESSAGE,
    };
  }

  const validation = validateTenantDefaultCurrencyForm(input);

  if (!validation.ok) {
    return {
      ...validation,
      message: validation.message ?? "Check the default currency.",
    };
  }

  try {
    const settings = await webAdminApi.tenant.settings.update(
      validation.data,
      requestOptions,
    );

    revalidateTenantCurrencyConsumers();

    return {
      ok: true,
      data: settings,
    };
  } catch (error) {
    return {
      ok: false,
      errors: {},
      message: getActionErrorMessage(error),
    };
  }
}
