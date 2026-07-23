/**
 * 瀹㈡埛绠＄悊 鈥?data access via the shared api-client.
 *
 * Thin wrappers around `posApi.pos.customers` / `posApi.pos.accounts` so
 * components do not import the client directly. Each function maps the UI
 * filter state to the wire query shape.
 */
import type {
  PosCustomerAccountSummary,
  PosCustomerListResult,
  PosCustomerProfileSummary,
} from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";

import { CUSTOMER_DEFAULT_FILTERS } from "../constants";
import type {
  CreatePosAccountRequest,
  CreatePosProfileRequest,
  CustomerFilterState,
  CustomerListRow,
  PosCustomerAccountDetail,
  PosCustomerProfileDetail,
  PosCustomerStatusChangeRequest,
  UpdatePosAccountRequest,
  UpdatePosProfileRequest,
} from "../types";

function toOffset(page: number, pageSize: number): number {
  return Math.max(0, (page - 1) * pageSize);
}

function toRow(
  entry: PosCustomerListResult["data"][number],
): CustomerListRow {
  if (entry.kind === "account") {
    return {
      kind: "account",
      id: entry.account.id,
      accountName: entry.account.accountName,
      phone: entry.account.phone,
      email: entry.account.email,
      status: entry.account.status,
      createdAt: entry.account.createdAt,
    };
  }
  return {
    kind: "profile",
    id: entry.profile.id,
    customerAccountId: entry.profile.customerAccountId,
    accountName: entry.profile.accountName,
    fullName: entry.profile.fullName,
    phone: entry.profile.phone,
    email: entry.profile.email,
    status: entry.profile.status,
    createdAt: entry.profile.createdAt,
  };
}

/** Fetch all accounts for the profile form dropdown (not paginated). */
export async function fetchAccountOptions(): Promise<PosCustomerAccountSummary[]> {
  const result = await posApi.pos.customers.list({
    resultType: "account",
    limit: 100,
    offset: 0,
  });
  return result.data
    .filter((entry) => entry.kind === "account")
    .map((entry) => entry.account);
}

/** Fetch the hybrid customer list, flattening the wire rows for rendering. */
export async function fetchCustomerList(
  filters: CustomerFilterState,
): Promise<{ rows: CustomerListRow[]; total: number; totalAccounts: number; totalProfiles: number }> {
  const result = await posApi.pos.customers.list({
    q: filters.query.trim() || undefined,
    resultType: filters.resultType === "all" ? undefined : filters.resultType,
    limit: filters.pageSize,
    offset: toOffset(filters.page, filters.pageSize),
  });

  return {
    rows: result.data.map(toRow),
    total: result.total,
    totalAccounts: result.totalAccounts,
    totalProfiles: result.totalProfiles,
  };
}

/** Fetch profiles nested under a specific account. */
export async function fetchAccountProfiles(
  accountId: string,
  filters: CustomerFilterState,
): Promise<{ rows: CustomerListRow[]; total: number }> {
  const response = await posApi.pos.accounts.listProfiles(accountId, {
    q: filters.query.trim() || undefined,
    limit: filters.pageSize,
    offset: toOffset(filters.page, filters.pageSize),
  });

  const rows: Extract<CustomerListRow, { kind: "profile" }>[] = response.data.map(
    (profile: PosCustomerProfileSummary) => ({
      kind: "profile" as const,
      id: profile.id,
      customerAccountId: profile.customerAccountId,
      accountName: "",
      fullName: profile.fullName,
      phone: profile.phone,
      email: profile.email,
      status: profile.status,
      createdAt: profile.createdAt,
    }),
  );

  return { rows, total: response.total };
}

// ---- account mutations ----------------------------------------------------

export function createAccount(
  input: CreatePosAccountRequest,
): Promise<PosCustomerAccountDetail> {
  return posApi.pos.accounts.create(input);
}

export function updateAccount(
  accountId: string,
  input: UpdatePosAccountRequest,
): Promise<PosCustomerAccountDetail> {
  return posApi.pos.accounts.update(accountId, input);
}

export function changeAccountStatus(
  accountId: string,
  input: PosCustomerStatusChangeRequest,
): Promise<PosCustomerAccountDetail> {
  return posApi.pos.accounts.changeStatus(accountId, input);
}

export async function deleteAccount(
  accountId: string,
  reason: string,
): Promise<void> {
  await posApi.pos.accounts.remove(accountId, reason);
}

// ---- profile mutations ----------------------------------------------------

export function createProfile(
  input: CreatePosProfileRequest & { customerAccountId: string },
): Promise<PosCustomerProfileSummary> {
  const { customerAccountId, ...body } = input;
  return posApi.pos.accounts.createProfile(customerAccountId, body);
}

export function updateProfile(
  customerId: string,
  input: UpdatePosProfileRequest,
): Promise<PosCustomerProfileDetail> {
  return posApi.pos.customers.update(customerId, input);
}

export function changeProfileStatus(
  customerId: string,
  input: PosCustomerStatusChangeRequest,
): Promise<PosCustomerProfileDetail> {
  return posApi.pos.customers.changeStatus(customerId, input);
}

export async function deleteProfile(
  customerId: string,
  reason: string,
): Promise<void> {
  await posApi.pos.customers.remove(customerId, reason);
}

// ---- customer-scoped tickets / orders --------------------------------------
// These power the customer detail page tabs. Each is a thin wrapper over the
// existing pos service-tickets / orders list endpoints, scoped by customerId.

/** Paginated service tickets for one customer. */
export async function fetchCustomerTickets(
  customerId: string,
  page: number,
  pageSize: number,
  filters?: {
    q?: string;
    ticketType?: import("@cleanhub/api-client").ServiceTicketType;
    createdAfter?: string;
    createdBefore?: string;
  },
): Promise<{ rows: import("@cleanhub/api-client").ServiceTicketSummary[]; total: number }> {
  const result = await posApi.pos.serviceTickets.list({
    customerId,
    q: filters?.q?.trim() || undefined,
    ticketType: filters?.ticketType,
    createdAfter: filters?.createdAfter,
    createdBefore: filters?.createdBefore,
    limit: pageSize,
    offset: toOffset(page, pageSize),
  });
  return { rows: result.data, total: result.total };
}

/** Paginated orders for one customer. */
export async function fetchCustomerOrders(
  customerId: string,
  page: number,
  pageSize: number,
  query = "",
): Promise<{ rows: import("@cleanhub/api-client").PosOrderSummary[]; total: number }> {
  const result = await posApi.pos.orders.list({
    customerId,
    q: query.trim() || undefined,
    limit: pageSize,
    offset: toOffset(page, pageSize),
  });
  return { rows: result.data, total: result.total };
}

/** Order stats for the overview strip: total count + lifetime paid. */
export async function fetchCustomerOrderStats(
  customerId: string,
): Promise<{ orderCount: number; totalPaid: number }> {
  const result = await posApi.pos.customers.orderStats(customerId);
  return {
    orderCount: result.orderCount,
    totalPaid: Number(result.totalPaid ?? 0),
  };
}

/**
 * Service items (ticket_items) across a customer's tickets, for the 服务项目 tab.
 */
export async function fetchCustomerServiceItems(
  customerId: string,
  page: number,
  pageSize: number,
  query = "",
): Promise<{
  items: Array<
    import("@cleanhub/api-client").ServiceTicketItem & {
      ticketNo: string | null;
      ticketType: import("@cleanhub/api-client").ServiceTicketType;
    }
  >;
  total: number;
}> {
  const result = await posApi.pos.customers.serviceItems(customerId, {
    q: query.trim() || undefined,
    limit: pageSize,
    offset: toOffset(page, pageSize),
  });

  return { items: result.data, total: result.total };
}
export { CUSTOMER_DEFAULT_FILTERS };
