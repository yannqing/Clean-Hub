export type TenantCustomerStatus = "active" | "disabled";

export type TenantCustomerSort =
  | "created_desc"
  | "created_asc"
  | "name_asc"
  | "name_desc";

export type TenantCustomerSummary = {
  id: string;
  customerAccountId: string;
  accountName: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: TenantCustomerStatus;
  createdAt: string;
};

export type TenantCustomerListQuery = {
  q?: string;
  status?: TenantCustomerStatus;
  branchId?: string;
  createdAfter?: string;
  createdBefore?: string;
  sort?: TenantCustomerSort;
  limit?: number;
  offset?: number;
};

export type TenantCustomerListResponse = {
  data: TenantCustomerSummary[];
  total: number;
  limit: number;
  offset: number;
};
