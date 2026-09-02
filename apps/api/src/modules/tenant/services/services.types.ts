import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

export type ServiceBusinessLine =
  | "laundry"
  | "car_wash"
  | "retail"
  | "delivery";

export type ServicePricingUnit = "per_item" | "per_kg";
export type ServiceStatus = "active" | "inactive";
export type ServiceLabelRule =
  | "none"
  | "per_item"
  | "per_order_item"
  | "per_bag";

export type ServiceBranchSettingInput = {
  branchId: string;
  isAvailable: boolean;
  priceOverrideAmount?: string | null;
  turnaroundMinutesOverride?: number | null;
};

export type ServiceBranchSetting = ServiceBranchSettingInput & {
  branchName: string;
  branchStatus: "active" | "inactive";
};

export type ServiceMediaRecord = {
  id: string;
  objectKey: string;
  isPrimary: boolean;
  sortOrder: number;
};

export type ServiceMedia = ServiceMediaRecord & {
  downloadUrl: string;
  expiresAt: string;
};

export type ServiceSummaryImage = {
  id: string;
};

export type ServiceListInput = {
  businessLine?: ServiceBusinessLine;
  status?: ServiceStatus;
  q?: string;
  limit: number;
  offset: number;
};

export type ServiceSummary = {
  id: string;
  tenantId: string;
  businessLine: ServiceBusinessLine;
  name: string;
  code: string | null;
  shortName: string | null;
  categoryId: string;
  categoryName: string;
  description: string | null;
  internalNotes: string | null;
  turnaroundMinutes: number | null;
  allBranches: boolean;
  availableBranchCount: number;
  displayOrder: number;
  pricingUnit: ServicePricingUnit;
  labelRule: ServiceLabelRule;
  standardPrice: string;
  compareAtPrice: string | null;
  costPrice: string | null;
  currency: string;
  status: ServiceStatus;
  primaryImage: ServiceSummaryImage | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type ServiceDetail = ServiceSummary & {
  branchSettings: ServiceBranchSetting[];
  media: ServiceMedia[];
};

export type ServiceDetailRecord = ServiceSummary & {
  branchSettings: ServiceBranchSetting[];
  media: ServiceMediaRecord[];
};

export type CreateServiceRequest = {
  businessLine: ServiceBusinessLine;
  name: string;
  code?: string | null;
  shortName?: string | null;
  categoryId: string;
  description?: string | null;
  internalNotes?: string | null;
  turnaroundMinutes?: number | null;
  allBranches?: boolean;
  branchSettings?: ServiceBranchSettingInput[];
  displayOrder?: number;
  pricingUnit: ServicePricingUnit;
  labelRule: ServiceLabelRule;
  standardPrice: string;
  compareAtPrice?: string | null;
  costPrice?: string | null;
  status?: ServiceStatus;
  mediaObjectKeys?: string[];
};

export type UpdateServiceRequest = Partial<
  Omit<CreateServiceRequest, "mediaObjectKeys">
> & {
  /** Optimistic-concurrency version from the record the editor last read. */
  version: number;
  retainedMediaIds?: string[];
  newMediaObjectKeys?: string[];
};

export type RequestTenantServiceMediaUpload = {
  contentType: string;
  sizeBytes: number;
};

export type RequestTenantServiceMediaDownloads = {
  items: Array<{
    serviceId: string;
    mediaId: string;
  }>;
};

export type TenantServiceMediaDownload = {
  serviceId: string;
  mediaId: string;
  downloadUrl: string;
  expiresAt: string;
};

export type TenantServiceMediaDownloadListResponse = {
  data: TenantServiceMediaDownload[];
};

export type TenantServiceMediaUploadTicket = {
  objectKey: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
};

export type TenantServiceInput<TData> = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: TData;
};

export type ServiceAuditSnapshot = {
  tenantId: string;
  businessLine: ServiceBusinessLine;
  name: string;
  code: string | null;
  shortName: string | null;
  categoryId: string;
  categoryName: string;
  description: string | null;
  internalNotes: string | null;
  turnaroundMinutes: number | null;
  allBranches: boolean;
  branchSettings: ServiceBranchSetting[];
  media: ServiceMediaRecord[];
  displayOrder: number;
  pricingUnit: ServicePricingUnit;
  labelRule: ServiceLabelRule;
  standardPrice: string;
  compareAtPrice: string | null;
  costPrice: string | null;
  currency: string;
  status: ServiceStatus;
};

export type ServicePriceAuditSnapshot = {
  id: string;
  tenantId: string;
  serviceId: string;
  serviceName: string;
  businessLine: ServiceBusinessLine;
  amount: string;
  compareAtAmount: string | null;
  costAmount: string | null;
  currency: string;
  status: ServiceStatus;
};
