export type TenantStatus = "active" | "suspended" | "disabled" | "draft";

export type TenantSummary = {
  id: string;
  name: string;
  pressingCode: string;
  status: TenantStatus;
  country?: string;
  city?: string;
  createdAt: string;
};

export type TenantDetail = TenantSummary & {
  defaultLanguage?: string;
  defaultCurrency?: string;
  contactName?: string;
  contactPhone?: string;
  branchCount?: number;
  userCount?: number;
};

export type CreateTenantRequest = {
  name: string;
  pressingCode: string;
  country: string;
  city?: string;
  defaultLanguage: string;
  defaultCurrency: string;
  contactName?: string;
  contactPhone?: string;
  status?: TenantStatus;
};

export type UpdateTenantRequest = Partial<CreateTenantRequest>;

export type UpdateTenantStatusRequest = {
  status: TenantStatus;
  reason: string;
};
