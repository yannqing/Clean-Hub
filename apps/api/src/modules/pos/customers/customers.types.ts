/**
 * POS customer management — DTOs.
 *
 * Two entities back POS customer management:
 *   - `customer_accounts` (account): the billable/contactable holder. A phone
 *     or email identifies an account; one account owns many profiles.
 *   - `customers` (profile): an individual person served under an account.
 *
 * Field shapes mirror the schema in packages/db/src/schema/commerce. Stats
 * (tier/balance/order count/last visit) are intentionally NOT modelled here:
 * the milestone doc defers those to other modules / real-time aggregation.
 */
import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

export type PosCustomerStatus = "active" | "disabled";

/**
 * List endpoint is a hybrid search: callers may search accounts or profiles
 * and may filter to one kind. A phone query also falls back to the profile
 * phone (customers.phone) per the reception flow.
 */
export type PosCustomerListResultType = "account" | "profile";

export type PosCustomerAccountSummary = {
  id: string;
  accountName: string;
  phone: string | null;
  email: string | null;
  status: PosCustomerStatus;
  createdAt: string;
};

export type PosCustomerAccountDetail = PosCustomerAccountSummary & {
  updatedAt: string;
  version: number;
};

export type PosCustomerProfileSummary = {
  id: string;
  customerAccountId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: PosCustomerStatus;
  createdAt: string;
};

export type PosCustomerProfileDetail = PosCustomerProfileSummary & {
  relationship: string | null;
  address: string | null;
  notes: string | null;
  updatedAt: string;
  version: number;
};

/**
 * A profile row joined with its owning account, used by the hybrid list and
 * the phone-fallback search. Kept flat so the list can mix accounts and
 * profiles without a discriminator union.
 */
export type PosCustomerProfileWithAccount = PosCustomerProfileSummary & {
  accountName: string;
};

export type ListPosCustomersQuery = {
  q?: string;
  resultType?: PosCustomerListResultType;
  status?: PosCustomerStatus;
  limit: number;
  offset: number;
};

/**
 * Hybrid list result. `data` mixes accounts and profiles (discriminated by
 * `kind`); `total` is the full match count across the same filters for
 * pagination rendering. When `resultType` pins one kind, `data` only holds
 * that kind and `total` counts only that kind.
 */
export type ListPosCustomersResult = {
  data: Array<
    | { kind: "account"; account: PosCustomerAccountSummary }
    | { kind: "profile"; profile: PosCustomerProfileWithAccount }
  >;
  total: number;
  limit: number;
  offset: number;
};

export type CreatePosAccountRequest = {
  accountName: string;
  /** Phone and email are mutually optional but at least one is required. */
  phone?: string;
  email?: string;
};

export type CreatePosProfileRequest = {
  fullName: string;
  phone?: string;
  email?: string;
  relationship?: string;
  address?: string;
  notes?: string;
};

export type UpdatePosAccountRequest = {
  accountName?: string;
  phone?: string | null;
  email?: string | null;
};

export type UpdatePosProfileRequest = {
  fullName?: string;
  phone?: string | null;
  email?: string | null;
  relationship?: string | null;
  address?: string | null;
  notes?: string | null;
};

export type ChangePosCustomerStatusRequest = {
  status: PosCustomerStatus;
  reason?: string;
};

// ---- Service input shapes -------------------------------------------------

export type ListPosCustomersInput = {
  authContext: AuthContext;
  query: ListPosCustomersQuery;
};

export type GetPosAccountInput = {
  authContext: AuthContext;
  accountId: string;
};

export type GetPosProfilesByAccountInput = {
  authContext: AuthContext;
  accountId: string;
};

export type GetPosProfileInput = {
  authContext: AuthContext;
  customerId: string;
};

export type CreatePosAccountInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: CreatePosAccountRequest;
};

export type CreatePosProfileInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  accountId: string;
  data: CreatePosProfileRequest;
};

export type UpdatePosAccountInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  accountId: string;
  data: UpdatePosAccountRequest;
};

export type UpdatePosProfileInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  customerId: string;
  data: UpdatePosProfileRequest;
};

export type ChangePosAccountStatusInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  accountId: string;
  data: ChangePosCustomerStatusRequest;
};

export type ChangePosProfileStatusInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  customerId: string;
  data: ChangePosCustomerStatusRequest;
};

export type DeletePosAccountInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  accountId: string;
  reason?: string;
};

export type DeletePosProfileInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  customerId: string;
  reason?: string;
};

// ---- Audit snapshots ------------------------------------------------------

export type PosAccountAuditSnapshot = {
  accountName: string;
  phone: string | null;
  email: string | null;
  status: PosCustomerStatus;
};

export type PosProfileAuditSnapshot = {
  customerAccountId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  relationship: string | null;
  address: string | null;
  notes: string | null;
  status: PosCustomerStatus;
};
