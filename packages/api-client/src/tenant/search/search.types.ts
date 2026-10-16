export type TenantGlobalSearchEntityType =
  | "order"
  | "customer"
  | "product"
  | "service"
  | "branch"
  | "user";

export type TenantGlobalSearchQuery = {
  q: string;
  limit?: number;
};

export type TenantGlobalSearchItem = {
  id: string;
  type: TenantGlobalSearchEntityType;
  title: string;
  subtitle?: string;
  badge?: string;
  href: string;
  updatedAt?: string;
  metadata?: {
    branchId?: string;
    contact?: string | null;
    currency?: string;
    customerId?: string;
    role?: string;
    skuCount?: number;
    totalAmount?: string;
  };
};

export type TenantGlobalSearchResponse = {
  query: string;
  total: number;
  groups: {
    orders: TenantGlobalSearchItem[];
    customers: TenantGlobalSearchItem[];
    products: TenantGlobalSearchItem[];
    services: TenantGlobalSearchItem[];
    branches: TenantGlobalSearchItem[];
    users: TenantGlobalSearchItem[];
  };
};
