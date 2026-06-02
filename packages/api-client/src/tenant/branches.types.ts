export type BranchStatus = "active" | "inactive";
export type BranchLanguage = "en" | "fr" | "zh-CN";
export type BranchBusinessHours = Record<string, unknown>;

export type BranchSummary = {
  id: string;
  tenantId: string;
  name: string;
  address: string | null;
  phone: string | null;
  businessHours: BranchBusinessHours | null;
  defaultLanguage: BranchLanguage;
  defaultCurrency: string;
  receiptName: string | null;
  receiptPhone: string | null;
  receiptAddress: string | null;
  logoUrl: string | null;
  status: BranchStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  version: number;
};

export type BranchListQuery = {
  q?: string;
  status?: BranchStatus;
  limit?: number;
  offset?: number;
};

export type CreateBranchRequest = {
  name: string;
  address?: string | null;
  phone?: string | null;
  businessHours?: BranchBusinessHours | null;
  defaultLanguage?: BranchLanguage;
  defaultCurrency?: string;
  receiptName?: string | null;
  receiptPhone?: string | null;
  receiptAddress?: string | null;
  logoUrl?: string | null;
  status?: BranchStatus;
};

export type UpdateBranchRequest = Partial<
  Omit<CreateBranchRequest, "status">
> & {
  version?: number;
};

export type UpdateBranchStatusRequest = {
  status: BranchStatus;
  version?: number;
  reason?: string;
};
