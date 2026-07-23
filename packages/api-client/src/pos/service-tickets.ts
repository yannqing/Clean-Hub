import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  ChangeServiceTicketItemStatusRequest,
  ChangeServiceTicketStatusRequest,
  CreateServiceTicketItemRequest,
  CreateServiceTicketRequest,
  RelatedOrderListResponse,
  ServiceTicketDetail,
  ServiceTicketItem,
  ServiceTicketListQuery,
  ServiceTicketListResponse,
  ServiceTicketOverview,
  UpdateServiceTicketItemRequest,
  UpdateServiceTicketRequest,
} from "./service-tickets.types";

const BASE = "/pos/service-tickets";

/**
 * Server-side callers (Next.js server components / server actions) need to
 * forward the incoming browser cookies. They do that by passing `options`
 * built from `getPosServerApiRequestOptions()`. We type it once here and
 * merge `{ query }` / body into the call so callers don't have to.
 */
type RequestOptions = Omit<ApiRequestOptions, "method" | "body">;

/**
 * POS service ticket (work order) API.
 *
 * Endpoint surface mirrors `apps/api/src/modules/pos/service-tickets/`.
 * Status transitions go through `POST /:ticketId/status-changes` (event-style,
 * with optimistic-concurrency `version`), not `PATCH /:ticketId/status`.
 */
export function createPosServiceTicketsApi(client: ApiClient) {
  return {
    list: (query?: ServiceTicketListQuery, options?: RequestOptions) =>
      client.get<ServiceTicketListResponse>(BASE, { ...options, query }),

    create: (
      input: CreateServiceTicketRequest,
      options?: RequestOptions,
    ) => client.post<ServiceTicketDetail>(BASE, input, options),

    getOverview: (
      query?: { branchId?: string },
      options?: RequestOptions,
    ) => client.get<ServiceTicketOverview>(`${BASE}/overview`, { ...options, query }),

    get: (ticketId: string, options?: RequestOptions) =>
      client.get<ServiceTicketDetail>(`${BASE}/${ticketId}`, options),

    update: (
      ticketId: string,
      input: UpdateServiceTicketRequest,
      options?: RequestOptions,
    ) =>
      client.patch<ServiceTicketDetail>(`${BASE}/${ticketId}`, input, options),

    remove: (ticketId: string, reason: string, options?: RequestOptions) =>
      client.delete<void>(`${BASE}/${ticketId}`, {
        ...options,
        query: { reason },
      }),

    changeStatus: (
      ticketId: string,
      input: ChangeServiceTicketStatusRequest,
      options?: RequestOptions,
    ) =>
      client.post<ServiceTicketDetail>(
        `${BASE}/${ticketId}/status-changes`,
        input,
        options,
      ),

    getRelatedOrders: (ticketId: string, options?: RequestOptions) =>
      client.get<RelatedOrderListResponse>(
        `${BASE}/${ticketId}/orders`,
        options,
      ),

    // --- items ---

    createItem: (
      ticketId: string,
      input: CreateServiceTicketItemRequest,
      options?: RequestOptions,
    ) =>
      client.post<ServiceTicketItem>(`${BASE}/${ticketId}/items`, input, options),

    updateItem: (
      ticketId: string,
      itemId: string,
      input: UpdateServiceTicketItemRequest,
      options?: RequestOptions,
    ) =>
      client.patch<ServiceTicketItem>(
        `${BASE}/${ticketId}/items/${itemId}`,
        input,
        options,
      ),

    changeItemStatus: (
      ticketId: string,
      itemId: string,
      input: ChangeServiceTicketItemStatusRequest,
      options?: RequestOptions,
    ) =>
      client.post<ServiceTicketItem>(
        `${BASE}/${ticketId}/items/${itemId}/status-changes`,
        input,
        options,
      ),

    removeItem: (
      ticketId: string,
      itemId: string,
      reason: string,
      options?: RequestOptions,
    ) =>
      client.delete<void>(`${BASE}/${ticketId}/items/${itemId}`, {
        ...options,
        query: { reason },
      }),
  };
}
