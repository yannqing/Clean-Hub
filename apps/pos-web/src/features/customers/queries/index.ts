/**
 * 瀹㈡埛绠＄悊 鈥?data access via the shared api-client.
 *
 * Thin wrappers around `posApi.pos.customers` / `posApi.pos.accounts` so
 * components do not import the client directly. Each function maps the UI
 * filter state to the wire query shape.
 */
import type {
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

/** Fetch the hybrid customer list, flattening the wire rows for rendering. */
export async function fetchCustomerList(
  filters: CustomerFilterState,
): Promise<{ rows: CustomerListRow[]; total: number }> {
  const result = await posApi.pos.customers.list({
    q: filters.query.trim() || undefined,
    resultType: filters.resultType === "all" ? undefined : filters.resultType,
    limit: filters.pageSize,
    offset: toOffset(filters.page, filters.pageSize),
  });

  return { rows: result.data.map(toRow), total: result.total };
}

/** Fetch profiles nested under a specific account. */
export async function fetchAccountProfiles(
  accountId: string,
  filters: CustomerFilterState,
): Promise<{ rows: CustomerListRow[]; total: number }> {
  const response = await posApi.pos.accounts.listProfiles(accountId);
  const q = filters.query.trim().toLowerCase();

  const all: Extract<CustomerListRow, { kind: "profile" }>[] = response.data.map(
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
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Account-scoped filtering is client-side (no server filter on this route).
  const filtered = q
    ? all.filter((row) =>
        [row.fullName, row.phone, row.email]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(q)),
      )
    : all;

  const total = filtered.length;
  const start = toOffset(filters.page, filters.pageSize);
  const paged = filtered.slice(start, start + filters.pageSize);

  return { rows: paged, total };
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

export async function deleteAccount(accountId: string): Promise<void> {
  await posApi.pos.accounts.remove(accountId);
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

export async function deleteProfile(customerId: string): Promise<void> {
  await posApi.pos.customers.remove(customerId);
}

export { CUSTOMER_DEFAULT_FILTERS };
