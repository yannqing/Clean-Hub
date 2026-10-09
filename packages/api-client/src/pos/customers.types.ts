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
  /** Total matching accounts across all pages (unaffected by resultType filter). */
  totalAccounts: number;
  /** Total matching profiles across all pages (unaffected by resultType filter). */
  totalProfiles: number;
  limit: number;
  offset: number;
};

// ---- status change --------------------------------------------------------

export type PosCustomerStatusChangeRequest = {
  status: PosCustomerStatus;
  reason?: string;
};

export type PosCustomerOrderStats = {
  orderCount: number;
  totalPaid: string;
};

export type PosCustomerServiceItemSummary = {
  id: string;
  ticketId: string;
  ticketNo: string | null;
  ticketType: import("./service-tickets.types").ServiceTicketType;
  itemType: import("./service-tickets.types").ServiceTicketItemType | null;
  itemName: string;
  itemCategory: string | null;
  itemStatus: import("./service-tickets.types").ServiceTicketItemStatus;
  itemColor: string | null;
  itemBrand: string | null;
  itemMaterial: string | null;
  quantity: number;
  pricingUnit: import("./service-tickets.types").ServiceTicketPricingUnit;
  standardUnitAmount: string;
  chargedUnitAmount: string;
  weight: string | null;
  bagCount: number | null;
  unitAmount: string;
  lineAmount: string;
  serviceId: string | null;
  labelCode: string | null;
  defectNotes: string | null;
  specialRequest: string | null;
  remark: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type PosCustomerServiceItemListQuery = {
  q?: string;
  limit?: number;
  offset?: number;
};

export type PosCustomerServiceItemListResult = {
  data: PosCustomerServiceItemSummary[];
  total: number;
  limit: number;
  offset: number;
};

// ---- profile body shapes --------------------------------------------------

export type CreatePosProfileRequest = {
  /** Stable client-generated ULID used by offline replay. */
  id?: string;
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
