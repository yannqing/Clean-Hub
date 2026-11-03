import type { ApiClient } from "../types";
import type {
  CreatePosReceptionEventRequest,
  PosReceptionEvent,
  PosReceptionEventListQuery,
  PosReceptionEventListResponse,
  PosReceptionSummary,
  PosReceptionSummaryQuery,
} from "./reception.types";

export function createPosReceptionApi(client: ApiClient) {
  return {
    list: (query?: PosReceptionEventListQuery) =>
      client.get<PosReceptionEventListResponse>("/pos/reception", { query }),
    create: (input: CreatePosReceptionEventRequest) =>
      client.post<PosReceptionEvent>("/pos/reception", input),
    getSummary: (query?: PosReceptionSummaryQuery) =>
      client.get<PosReceptionSummary>("/pos/reception/summary", { query }),
  };
}
