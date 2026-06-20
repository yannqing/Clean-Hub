export type PosCustomerStatus = "active" | "blocked";

export type PosCustomerSummary = {
  id: string;
  fullName: string;
  phone: string;
  status: PosCustomerStatus;
};

export type PosCustomerDetail = PosCustomerSummary & {
  address: string | null;
  notes: string | null;
  orderCount: number;
  createdAt: string;
};

export type PosCustomerListQuery = {
  q?: string;
  limit?: number;
  offset?: number;
};

export type PosCustomerListResponse = {
  data: PosCustomerSummary[];
};

export type CreatePosCustomerRequest = {
  fullName: string;
  phone: string;
  address?: string;
  notes?: string;
};
