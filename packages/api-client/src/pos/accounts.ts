import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  CreatePosAccountRequest,
  PosAccountProfilesQuery,
  PosAccountProfilesResponse,
  PosCustomerStatusChangeRequest,
  UpdatePosAccountRequest,
} from "./accounts.types";
import type {
  PosCustomerAccountDetail,
  PosCustomerProfileSummary,
} from "./customers.types";

/**
 * POS customer ACCOUNT api. Mounted under `/pos/accounts`.
 *
 * An account owns one or more profiles. Creating a profile under an account
 * is nested (`POST /:accountId/customers`).
 */
export function createPosAccountsApi(client: ApiClient) {
  return {
    /** Create a customer account. POST /pos/accounts */
    create: (
      input: CreatePosAccountRequest,
      options?: Omit<ApiRequestOptions, "method" | "body" | "query">,
    ) => client.post<PosCustomerAccountDetail>("/pos/accounts", input, options),

    /** Account detail. GET /pos/accounts/:accountId */
    get: (accountId: string) =>
      client.get<PosCustomerAccountDetail>(`/pos/accounts/${accountId}`),

    /** Profiles under an account. GET /pos/accounts/:accountId/customers */
    listProfiles: (accountId: string, query?: PosAccountProfilesQuery) =>
      client.get<PosAccountProfilesResponse>(
        `/pos/accounts/${accountId}/customers`,
        { query },
      ),

    /** Create a profile nested under an account. POST /pos/accounts/:accountId/customers */
    createProfile: (
      accountId: string,
      input: {
        fullName: string;
        phone?: string;
        email?: string;
        relationship?: string;
        address?: string;
        notes?: string;
      },
    ) =>
      client.post<PosCustomerProfileSummary>(
        `/pos/accounts/${accountId}/customers`,
        input,
      ),

    /** Update account basic info. PATCH /pos/accounts/:accountId */
    update: (accountId: string, input: UpdatePosAccountRequest) =>
      client.patch<PosCustomerAccountDetail>(
        `/pos/accounts/${accountId}`,
        input,
      ),

    /** Change account status (active/disabled). POST /pos/accounts/:accountId/status-changes */
    changeStatus: (
      accountId: string,
      input: PosCustomerStatusChangeRequest,
    ) =>
      client.post<PosCustomerAccountDetail>(
        `/pos/accounts/${accountId}/status-changes`,
        input,
      ),

    /** Soft delete an account (cascades to its profiles). DELETE /pos/accounts/:accountId */
    remove: (accountId: string, reason: string) =>
      client.delete<void>(`/pos/accounts/${accountId}`, {
        query: { reason },
      }),
  };
}
