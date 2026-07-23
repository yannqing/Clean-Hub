import type { ApiClient } from "../types";
import type {
  PosCustomerOrderStats,
  PosCustomerListQuery,
  PosCustomerListResult,
  PosCustomerProfileDetail,
  PosCustomerProfileSummary,
  PosCustomerServiceItemListQuery,
  PosCustomerServiceItemListResult,
  PosCustomerStatusChangeRequest,
  UpdatePosProfileRequest,
} from "./customers.types";

/**
 * POS customer PROFILE api. Mounted under `/pos/customers`.
 *
 * A customer account owns one or more profiles. The hybrid list searches
 * across both accounts and profiles; profile read/write/delete/status live
 * here, while account read/write/delete/status live in `accounts.ts`.
 */
export function createPosCustomersApi(client: ApiClient) {
  return {
    /** Hybrid search across accounts and profiles. GET /pos/customers */
    list: (query?: PosCustomerListQuery) =>
      client.get<PosCustomerListResult>("/pos/customers", { query }),

    /** Profile detail. GET /pos/customers/:customerId */
    get: (customerId: string) =>
      client.get<PosCustomerProfileDetail>(`/pos/customers/${customerId}`),

    /** Profile lifetime order stats. GET /pos/customers/:customerId/order-stats */
    orderStats: (customerId: string) =>
      client.get<PosCustomerOrderStats>(
        `/pos/customers/${customerId}/order-stats`,
      ),

    /** Profile service items across all tickets. GET /pos/customers/:customerId/service-items */
    serviceItems: (
      customerId: string,
      query?: PosCustomerServiceItemListQuery,
    ) =>
      client.get<PosCustomerServiceItemListResult>(
        `/pos/customers/${customerId}/service-items`,
        { query },
      ),

    /** Update profile basic info. PATCH /pos/customers/:customerId */
    update: (customerId: string, input: UpdatePosProfileRequest) =>
      client.patch<PosCustomerProfileDetail>(
        `/pos/customers/${customerId}`,
        input,
      ),

    /** Change profile status (active/disabled). POST /pos/customers/:customerId/status-changes */
    changeStatus: (
      customerId: string,
      input: PosCustomerStatusChangeRequest,
    ) =>
      client.post<PosCustomerProfileDetail>(
        `/pos/customers/${customerId}/status-changes`,
        input,
      ),

    /** Soft delete a profile. DELETE /pos/customers/:customerId */
    remove: (customerId: string, reason: string) =>
      client.delete<void>(`/pos/customers/${customerId}`, {
        query: { reason },
      }),
  };
}

// Re-export profile summary type used by the account-scoped list, so callers
// importing from `pos/customers` do not need to also reach into the types
// module for the array element shape.
export type { PosCustomerProfileSummary };
