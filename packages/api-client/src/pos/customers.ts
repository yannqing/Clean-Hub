import type { ApiClient } from "../types";
import type {
  CreatePosCustomerRequest,
  PosCustomerDetail,
  PosCustomerListQuery,
  PosCustomerListResponse,
} from "./customers.types";

export function createPosCustomersApi(client: ApiClient) {
  return {
    list: (query?: PosCustomerListQuery) =>
      client.get<PosCustomerListResponse>("/pos/customers", { query }),
    get: (customerId: string) =>
      client.get<PosCustomerDetail>(`/pos/customers/${customerId}`),
    create: (input: CreatePosCustomerRequest) =>
      client.post<PosCustomerDetail>("/pos/customers", input),
  };
}
