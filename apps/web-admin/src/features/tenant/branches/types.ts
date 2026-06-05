import type {
  BranchBusinessHours,
  BranchDetail,
  BranchLanguage,
  BranchListQuery,
  BranchStatus,
  BranchSummary,
  CreateBranchRequest,
  UpdateBranchRequest,
  UpdateBranchStatusRequest,
} from "@cleanhub/api-client";

export type {
  BranchBusinessHours,
  BranchDetail,
  BranchLanguage,
  BranchListQuery,
  BranchStatus,
  BranchSummary,
  CreateBranchRequest,
  UpdateBranchRequest,
  UpdateBranchStatusRequest,
};

export type BranchListFilters = Pick<BranchListQuery, "q" | "status">;

export type BranchFormValues = {
  name: string;
  address: string;
  phone: string;
  defaultLanguage: BranchLanguage;
  defaultCurrency: string;
  receiptName: string;
  receiptPhone: string;
  receiptAddress: string;
  logoUrl: string;
  businessHoursJson: string;
  status: BranchStatus;
  version?: number;
};
