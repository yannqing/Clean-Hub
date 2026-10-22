"use server";

import { revalidatePath } from "next/cache";
import { webAdminApi } from "@/lib/api-client";
import { getTenantServerApiRequestOptions } from "../../server/api-request-options";

export async function requestTenantPosLogoUploadAction(input: {
  contentType: string;
  sizeBytes: number;
}) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(input.contentType) ||
    !Number.isInteger(input.sizeBytes) ||
    input.sizeBytes <= 0 ||
    input.sizeBytes > 5 * 1024 * 1024
  ) {
    return { ok: false as const };
  }
  try {
    const ticket = await webAdminApi.tenant.settings.requestPosLogoUpload(
      {
        contentType: input.contentType as
          | "image/jpeg"
          | "image/png"
          | "image/webp",
        sizeBytes: input.sizeBytes,
      },
      await getTenantServerApiRequestOptions(),
    );
    return { ok: true as const, ticket };
  } catch {
    return { ok: false as const };
  }
}

export async function updateTenantPosBrandingAction(input: {
  posDisplayName: string;
  posLogoObjectKey: string | null;
}) {
  const posDisplayName = input.posDisplayName.trim();
  if (
    (!posDisplayName && !input.posLogoObjectKey) ||
    posDisplayName.length > 160
  ) {
    return { ok: false as const };
  }
  try {
    const data = await webAdminApi.tenant.settings.update(
      { ...input, posDisplayName },
      await getTenantServerApiRequestOptions(),
    );
    revalidatePath("/tenant/system/settings");
    return { ok: true as const, data };
  } catch {
    return { ok: false as const };
  }
}
