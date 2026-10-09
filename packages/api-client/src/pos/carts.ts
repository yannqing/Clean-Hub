import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  PosCartPricePreview,
  ClaimPosCartRequest,
  ParkPosCartRequest,
  PosParkedCartListResponse,
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
    listParked: (options?: RequestOptions) =>
      client.get<PosParkedCartListResponse>("/pos/carts/parked", options),
    parkCurrent: (input: ParkPosCartRequest, options?: RequestOptions) =>
      client.post<PosSavedCart>("/pos/carts/current/park", input, options),
    claim: (
      cartId: string,
      input: ClaimPosCartRequest = {},
      options?: RequestOptions,
    ) => client.post<PosSavedCart>(`/pos/carts/${cartId}/claim`, input, options),
    preview: (input: PreviewPosCartRequest, options?: RequestOptions) =>
      client.post<PosCartPricePreview>("/pos/carts/preview", input, options),
  };
}
