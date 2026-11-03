export type PosGlobalSearchEntityType = "customer" | "ticket" | "order";

export type PosGlobalSearchQuery = {
  q: string;
  limit?: number;
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
