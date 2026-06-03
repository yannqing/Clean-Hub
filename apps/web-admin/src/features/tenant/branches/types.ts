import type {
  BranchBusinessHours,
  BranchLanguage,
  BranchListQuery,
  BranchStatus,
  BranchSummary,
} from "@cleanhub/api-client";

export type {
  BranchBusinessHours,
  BranchLanguage,
  BranchListQuery,
  BranchStatus,
  BranchSummary,
};

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

export type BranchListFilters = {
  q?: string;
  status?: BranchStatus;
};

export type ParsedBranchBusinessHours = BranchBusinessHours | null;
