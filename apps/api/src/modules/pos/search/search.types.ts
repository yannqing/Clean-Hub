import type { AuthContext } from "../../auth/auth.types.js";

export type PosGlobalSearchEntityType = "customer" | "ticket" | "order";

export type PosGlobalSearchQuery = {
  q: string;
  limit: number;
};

export type PosGlobalSearchItem = {
  id: string;
  type: PosGlobalSearchEntityType;
  title: string;
  subtitle?: string;
  badge?: string;
  href: string;
  updatedAt?: string;
  metadata?: {
    accountName?: string | null;
    contact?: string | null;
    itemCount?: number;
    totalAmount?: string | null;
  };
};

export type PosGlobalSearchResponse = {
  query: string;
  total: number;
  groups: {
    customers: PosGlobalSearchItem[];
    tickets: PosGlobalSearchItem[];
    orders: PosGlobalSearchItem[];
  };
};

export type PosGlobalSearchInput = {
  authContext: AuthContext;
  query: PosGlobalSearchQuery;
};

export type PosGlobalSearchRepositoryInput = {
  tenantId: string;
  allowedBranchIds?: string[];
  q: string;
  limit: number;
};
