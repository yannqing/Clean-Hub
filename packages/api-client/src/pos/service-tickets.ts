import type { ApiClient } from "../types";
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
 * POS service ticket (work order) API.
 *
 * Endpoint surface mirrors `apps/api/src/modules/pos/service-tickets/`.
 * Status transitions go through `POST /:ticketId/status-changes` (event-style,
 * with optimistic-concurrency `version`), not `PATCH /:ticketId/status`.
 */
export function createPosServiceTicketsApi(client: ApiClient) {
  return {
    list: (query?: ServiceTicketListQuery) =>
      client.get<ServiceTicketListResponse>(BASE, { query }),

    create: (input: CreateServiceTicketRequest) =>
      client.post<ServiceTicketDetail>(BASE, input),

    getOverview: (query?: { branchId?: string }) =>
      client.get<ServiceTicketOverview>(`${BASE}/overview`, { query }),

    get: (ticketId: string) =>
      client.get<ServiceTicketDetail>(`${BASE}/${ticketId}`),

    update: (ticketId: string, input: UpdateServiceTicketRequest) =>
      client.patch<ServiceTicketDetail>(`${BASE}/${ticketId}`, input),

    remove: (ticketId: string) =>
      client.delete<void>(`${BASE}/${ticketId}`),

    changeStatus: (
      ticketId: string,
      input: ChangeServiceTicketStatusRequest,
    ) =>
      client.post<ServiceTicketDetail>(
        `${BASE}/${ticketId}/status-changes`,
        input,
      ),

    getRelatedOrders: (ticketId: string) =>
      client.get<RelatedOrderListResponse>(`${BASE}/${ticketId}/orders`),

    // --- items ---

    createItem: (ticketId: string, input: CreateServiceTicketItemRequest) =>
      client.post<ServiceTicketItem>(`${BASE}/${ticketId}/items`, input),

    updateItem: (
      ticketId: string,
      itemId: string,
      input: UpdateServiceTicketItemRequest,
    ) =>
      client.patch<ServiceTicketItem>(
        `${BASE}/${ticketId}/items/${itemId}`,
        input,
      ),

    changeItemStatus: (
      ticketId: string,
      itemId: string,
      input: ChangeServiceTicketItemStatusRequest,
    ) =>
      client.post<ServiceTicketItem>(
        `${BASE}/${ticketId}/items/${itemId}/status-changes`,
        input,
      ),

    removeItem: (ticketId: string, itemId: string) =>
      client.delete<void>(`${BASE}/${ticketId}/items/${itemId}`),
  };
}
