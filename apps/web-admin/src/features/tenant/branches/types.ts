import type {
  BranchBusinessHours,
  BranchLanguage,
  BranchStatus,
  BranchSummary as ApiBranchSummary,
} from "@cleanhub/api-client";

export type { BranchLanguage, BranchStatus };
export type BranchSummary = ApiBranchSummary;

export type BranchFormValues = {
  name: string;
  address: string;
  phone: string;
  businessHours: string;
  defaultLanguage: BranchLanguage;
  defaultCurrency: string;
  receiptName: string;
  receiptPhone: string;
  receiptAddress: string;
  logoUrl: string;
  status: BranchStatus;
  version?: number;
};

export type BranchListFilters = {
  q?: string;
  status?: BranchStatus;
};

export type ParsedBranchBusinessHours = BranchBusinessHours | null;
