export type TenantStatus = "active" | "suspended" | "draft";

export type TenantSummary = {
  id: string;
  name: string;
  status: TenantStatus;
};

export type TenantDetail = TenantSummary & {
  ownerEmail: string;
};
