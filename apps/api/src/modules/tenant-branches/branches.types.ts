import type { AuthContext, AuthRequestMeta } from "../auth/auth.types.js";

export type BranchStatus = "active" | "inactive";
export type BranchLanguage = "en" | "fr" | "zh-CN";
export type BranchBusinessHours = Record<string, unknown>;

export type BranchSummary = {
  id: string;
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
  updatedAt: string;
  version: number;
};

export type BranchListInput = {
  q?: string;
  status?: BranchStatus;
  limit: number;
  offset: number;
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
  version: number;
};

export type UpdateBranchStatusRequest = {
  status: BranchStatus;
  version: number;
};

export type BranchRequestInput<TData> = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: TData;
};

export type BranchAuditSnapshot = Omit<BranchSummary, "updatedAt">;
