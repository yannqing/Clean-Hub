import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  MobileMediaUploadTicket,
  MobileRequestMediaUploadRequest,
} from "./media.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createMobileMediaApi(client: ApiClient) {
  return {
    requestUpload: (
      input: MobileRequestMediaUploadRequest,
      options?: RequestOptions,
    ) =>
      client.post<MobileMediaUploadTicket>(
        "/mobile/media/uploads",
        input,
        options,
      ),
  };
}
