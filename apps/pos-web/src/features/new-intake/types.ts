/**
 * 客户接待 — local types.
 *
 * Wire DTOs are re-exported from @cleanhub/api-client so the wire shape stays
 * the single source of truth. UI-only types live below.
 */
export type { PosReceptionEvent } from "@cleanhub/api-client";

/**
 * A flattened profile row for the intake lookup. Mirrors the profile variant
 * of the customer-management `CustomerListRow`, but kept local so the intake
 * feature does not depend on the customers feature's internal types.
 */
export type IntakeProfileRow = {
  id: string;
  customerAccountId: string;
  accountName: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: "active" | "disabled";
  createdAt: string;
};

/** Query + pagination state for the intake profile search. */
export type IntakeProfileQuery = {
  q: string;
  page: number;
  pageSize: number;
};

/**
 * Create-customer-account form values. Phone and email are mutually optional
 * but at least one is required (enforced by the backend `POS_PHONE_OR_EMAIL_REQUIRED`).
 */
export type IntakeCreateAccountInput = {
  accountName: string;
  accountPhone: string;
  accountEmail: string;
};

/**
 * Create-customer-profile form values. A profile always belongs to an account,
 * so `accountId` is required; the rest describe the person receiving service.
 */
export type IntakeCreateProfileInput = {
  accountId: string;
  fullName: string;
  profilePhone: string;
  profileEmail: string;
  relationship: string;
};
