import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  PosCartPricePreview,
  PosSavedCart,
  PreviewPosCartRequest,
  SavePosCartRequest,
  SavePosCartResponse,
} from "./carts.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createPosCartsApi(client: ApiClient) {
  return {
    getCurrent: (options?: RequestOptions) =>
      client.get<PosSavedCart | null>("/pos/carts/current", options),
    saveCurrent: (input: SavePosCartRequest, options?: RequestOptions) =>
      client.put<SavePosCartResponse>("/pos/carts/current", input, options),
    clearCurrent: (options?: RequestOptions) =>
      client.delete<void>("/pos/carts/current", {
        parseAs: "void",
        ...options,
      }),
    preview: (input: PreviewPosCartRequest, options?: RequestOptions) =>
      client.post<PosCartPricePreview>("/pos/carts/preview", input, options),
  };
}
