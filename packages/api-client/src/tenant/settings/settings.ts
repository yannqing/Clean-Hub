import type { ApiClient, ApiRequestOptions } from "../../types";
import type {
  TenantSettings,
  UpdateTenantSettingsRequest,
} from "./settings.types";

export type TenantPosLogoUploadTicket = {
  objectKey: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
};

type ApiOptionsWithoutBody = Omit<ApiRequestOptions, "method" | "body">;

export function createTenantSettingsApi(client: ApiClient) {
  return {
    requestPosLogoUpload: (
      input: {
        contentType: "image/jpeg" | "image/png" | "image/webp";
        sizeBytes: number;
      },
      options: ApiOptionsWithoutBody = {},
    ) =>
      client.post<TenantPosLogoUploadTicket>(
        "/tenant/settings/pos-logo/upload-ticket",
        input,
        options,
      ),
    get: (options: ApiOptionsWithoutBody = {}) =>
      client.get<TenantSettings>("/tenant/settings", options),
    update: (
      input: UpdateTenantSettingsRequest,
      options: ApiOptionsWithoutBody = {},
    ) => client.patch<TenantSettings>("/tenant/settings", input, options),
  };
}
