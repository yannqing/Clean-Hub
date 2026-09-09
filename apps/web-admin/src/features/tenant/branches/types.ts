import type {
  BranchBusinessHours,
  BranchBusinessDayHours,
  BranchDetail,
  BranchLanguage,
  BranchListQuery,
  PosReceiptField,
  PosTicketLabelField,
  BranchStatus,
  BranchSummary,
  BranchWeekday,
  CreateBranchRequest,
  UpdateBranchRequest,
  UpdateBranchStatusRequest,
} from "@cleanhub/api-client";

export type {
  BranchBusinessHours,
  BranchBusinessDayHours,
  BranchDetail,
  BranchLanguage,
  BranchListQuery,
  BranchStatus,
  BranchSummary,
  BranchWeekday,
  PosReceiptField,
  PosTicketLabelField,
  CreateBranchRequest,
  UpdateBranchRequest,
  UpdateBranchStatusRequest,
};

export type BranchListFilters = Pick<BranchListQuery, "q" | "status">;

export type BranchBusinessDayFormValues = {
  enabled: boolean;
  opensAt: string;
  closesAt: string;
};

export type BranchBusinessHoursFormValues = Record<
  BranchWeekday,
  BranchBusinessDayFormValues
>;

export type BranchFormValues = {
  name: string;
  address: string;
  phone: string;
  defaultLanguage: BranchLanguage;
  defaultCurrency: string;
  receiptName: string;
  receiptPhone: string;
  receiptAddress: string;
  receiptFields: PosReceiptField[];
  logoObjectKey: string;
  removeLogo: boolean;
  businessHours: BranchBusinessHoursFormValues;
  status: BranchStatus;
  version?: number;
};
