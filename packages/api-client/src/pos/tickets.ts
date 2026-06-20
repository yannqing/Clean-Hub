import type { ApiClient } from "../types";
import type {
  CreatePosTicketRequest,
  PosTicketDetail,
  PosTicketListQuery,
  PosTicketListResponse,
  UpdatePosTicketStatusRequest,
} from "./tickets.types";

export function createPosTicketsApi(client: ApiClient) {
  return {
    list: (query?: PosTicketListQuery) =>
      client.get<PosTicketListResponse>("/pos/tickets", { query }),
    get: (ticketId: string) =>
      client.get<PosTicketDetail>(`/pos/tickets/${ticketId}`),
    create: (input: CreatePosTicketRequest) =>
      client.post<PosTicketDetail>("/pos/tickets", input),
    updateStatus: (ticketId: string, input: UpdatePosTicketStatusRequest) =>
      client.patch<PosTicketDetail>(`/pos/tickets/${ticketId}/status`, input),
  };
}
