/**
 * POS customer ACCOUNT DTOs.
 *
 * Accounts live under `/pos/accounts`. Types that are shared with profiles
 * (status, status-change request) are re-exported from `customers.types` so a
 * single source of truth holds the customer status enum.
 */
import type {
  PosCustomerStatus,
  PosCustomerStatusChangeRequest,
} from "./customers.types";

export type { PosCustomerStatus, PosCustomerStatusChangeRequest };

import type { PosCustomerProfileSummary } from "./customers.types";

export type PosAccountProfilesQuery = {
  q?: string;
  limit?: number;
  offset?: number;
};

export type PosAccountProfilesResponse = {
  data: PosCustomerProfileSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type CreatePosAccountRequest = {
  /** Stable client-generated ULID used by offline replay. */
  id?: string;
  accountName: string;
  /** Phone and email are mutually optional but at least one is required. */
  phone?: string;
  email?: string;
};

export type UpdatePosAccountRequest = {
  accountName?: string;
  phone?: string | null;
  email?: string | null;
};
