import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";
import type {
  PosReceiptField,
  PosTicketLabelField,
} from "@cleanhub/domain/receipt";

export type BranchStatus = "active" | "inactive";
export type BranchLanguage = "en" | "fr" | "zh-CN";
export type BranchWeekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";
export type BranchBusinessDayHours = {
  opensAt: string;
  closesAt: string;
};
export type BranchBusinessHours = Partial<
  Record<BranchWeekday, BranchBusinessDayHours>
>;

export type BranchPaymentMethod = "cash" | "card" | "app";

export type BranchCashHandlingMode =
  | "none"
  | "untracked"
  | "shared_drawer"
  | "cash_in_hand";

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
  receiptFields: PosReceiptField[];
  ticketLabelFields: PosTicketLabelField[];
  paymentMethodsEnabled: BranchPaymentMethod[];
  defaultPaymentMethod: BranchPaymentMethod;
  cashHandlingMode: BranchCashHandlingMode;
  logoObjectKey: string | null;
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
  receiptName?: string | null;
  receiptPhone?: string | null;
  receiptAddress?: string | null;
  receiptFields?: PosReceiptField[];
  ticketLabelFields?: PosTicketLabelField[];
  paymentMethodsEnabled?: BranchPaymentMethod[];
  defaultPaymentMethod?: BranchPaymentMethod;
  cashHandlingMode?: BranchCashHandlingMode;
  logoObjectKey?: string | null;
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

export type RequestBranchLogoUpload = {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  sizeBytes: number;
};

export type BranchLogoUploadTicket = {
  objectKey: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
};
