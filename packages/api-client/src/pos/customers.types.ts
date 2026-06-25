/**
 * POS customer management DTOs.
 *
 * Two entities back POS customer management:
 *   - customer account (`/pos/accounts`)
 *   - customer profile (`/pos/customers`, always nested under an account)
 *
 * Field shapes mirror apps/api/src/modules/pos/customers/customers.types.ts.
 * Stats (tier/balance/order count/last visit) are intentionally NOT modelled
 * here: the milestone doc defers those to other modules / real-time
 * aggregation.
 */

export type PosCustomerStatus = "active" | "disabled";

// ---- shared query ---------------------------------------------------------

export type PosCustomerListResultType = "account" | "profile";

// ---- account --------------------------------------------------------------

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

// ---- profile --------------------------------------------------------------

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
 * profiles without a discriminator union on the wire.
 */
export type PosCustomerProfileWithAccount = PosCustomerProfileSummary & {
  accountName: string;
};

// ---- hybrid list ----------------------------------------------------------

export type PosCustomerListQuery = {
  q?: string;
  resultType?: PosCustomerListResultType;
  status?: PosCustomerStatus;
  limit?: number;
  offset?: number;
};

export type PosCustomerListResult = {
  data: Array<
    | { kind: "account"; account: PosCustomerAccountSummary }
    | { kind: "profile"; profile: PosCustomerProfileWithAccount }
  >;
  total: number;
  limit: number;
  offset: number;
};

// ---- status change --------------------------------------------------------

export type PosCustomerStatusChangeRequest = {
  status: PosCustomerStatus;
  reason?: string;
};

// ---- profile body shapes --------------------------------------------------

export type CreatePosProfileRequest = {
  fullName: string;
  phone?: string;
  email?: string;
  relationship?: string;
  address?: string;
  notes?: string;
};

export type UpdatePosProfileRequest = {
  fullName?: string;
  phone?: string | null;
  email?: string | null;
  relationship?: string | null;
  address?: string | null;
  notes?: string | null;
};
