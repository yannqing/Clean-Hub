/**
 * 客户管理 — local types.
 *
 * Wire DTOs are re-exported from @cleanhub/api-client so the backend stays
 * the single source of truth. Only UI-only types (form state, filter state,
 * view modes) are defined here.
 */
export type {
  PosCustomerStatus,
  PosCustomerListResultType,
  PosCustomerAccountSummary,
  PosCustomerAccountDetail,
  PosCustomerProfileSummary,
  PosCustomerProfileDetail,
  PosCustomerProfileWithAccount,
  PosCustomerListQuery,
  PosCustomerListResult,
  CreatePosProfileRequest,
  UpdatePosProfileRequest,
  CreatePosAccountRequest,
  UpdatePosAccountRequest,
  PosCustomerStatusChangeRequest,
} from "@cleanhub/api-client";

// ---- UI-only types --------------------------------------------------------

/** Page view mode: full customer list vs. an account's profile list. */
export type CustomerViewMode = "list" | "account";

/** A single row in the mixed table, flattened for rendering. */
export type CustomerListRow =
  | {
      kind: "account";
      id: string;
      accountName: string;
      phone: string | null;
      email: string | null;
      status: "active" | "disabled";
      createdAt: string;
    }
  | {
      kind: "profile";
      id: string;
      customerAccountId: string;
      accountName: string;
      fullName: string;
      phone: string | null;
      email: string | null;
      status: "active" | "disabled";
      createdAt: string;
    };

/** Result-type filter options for the search bar dropdown. */
export type ResultTypeFilter = "all" | "account" | "profile";

/** Filter + pagination state shared by the list and account views. */
export type CustomerFilterState = {
  query: string;
  resultType: ResultTypeFilter;
  page: number;
  pageSize: number;
};

/** Account-form values for the create/edit dialog. */
export type AccountFormValues = {
  accountName: string;
  phone: string;
  email: string;
};

/** Profile-form values for the create/edit dialog. */
export type ProfileFormValues = {
  customerAccountId: string;
  fullName: string;
  phone: string;
  email: string;
  relationship: string;
  address: string;
  notes: string;
};

/** Which dialog (if any) is currently open. */
export type CustomerDialogState =
  | { type: "none" }
  | { type: "create-account" }
  | { type: "edit-account"; accountId: string }
  | { type: "create-profile" }
  | { type: "edit-profile"; customerId: string }
  | { type: "delete-account"; accountId: string; accountName: string }
  | { type: "delete-profile"; customerId: string; fullName: string };
