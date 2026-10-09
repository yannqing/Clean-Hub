import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  PosOfflineSaleException,
  PosOfflineSaleExceptionListResponse,
  ReportPosOfflineSaleExceptionRequest,
  ResolvePosOfflineSaleExceptionRequest,
  ResolvePosOfflineSaleExceptionResponse,
} from "./offline-sales.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createPosOfflineSalesApi(client: ApiClient) {
  return {
    list: (
      query?: { status?: "open" | "resolved"; limit?: number },
      options?: RequestOptions,
    ) =>
      client.get<PosOfflineSaleExceptionListResponse>(
        "/pos/offline-sale-exceptions",
        { query, ...options },
      ),
    get: (commandId: string, options?: RequestOptions) =>
      client.get<PosOfflineSaleException>(
        `/pos/offline-sale-exceptions/${encodeURIComponent(commandId)}`,
        options,
      ),
    report: (
      input: ReportPosOfflineSaleExceptionRequest,
      options?: RequestOptions,
    ) =>
      client.post<PosOfflineSaleException>(
        "/pos/offline-sale-exceptions",
        input,
        options,
      ),
    resolve: (
      commandId: string,
      input: ResolvePosOfflineSaleExceptionRequest,
      options?: RequestOptions,
    ) =>
      client.post<ResolvePosOfflineSaleExceptionResponse>(
        `/pos/offline-sale-exceptions/${encodeURIComponent(commandId)}/resolve`,
        input,
        options,
      ),
    acknowledgeRecovered: (commandId: string, options?: RequestOptions) =>
      client.post<PosOfflineSaleException | null>(
        `/pos/offline-sale-exceptions/${encodeURIComponent(commandId)}/acknowledge-recovered`,
        {},
        options,
      ),
  };
}
