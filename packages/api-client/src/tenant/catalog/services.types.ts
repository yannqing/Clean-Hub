export type ServicePricingUnit = "per_item" | "per_kg";
export type ServiceStatus = "active" | "inactive";
export type ServiceLabelRule =
  | "none"
  | "per_item"
  | "per_order_item"
  | "per_bag";
export type ServiceBusinessLine =
  | "laundry"
  | "car_wash"
  | "retail"
  | "delivery";

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

export type ServiceMedia = {
  id: string;
  objectKey: string;
  downloadUrl: string;
  expiresAt: string;
  isPrimary: boolean;
  sortOrder: number;
};

export type ServiceSummaryImage = {
  id: string;
};

export type ServiceSummary = {
  id: string;
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

export type RequestTenantServiceMediaUploadRequest = {
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

export type UpdateServiceStatusRequest = {
  status: ServiceStatus;
  /** Optimistic-concurrency version from the record the editor last read. */
  version: number;
};

export type ServiceListQuery = {
  businessLine?: ServiceBusinessLine;
  status?: ServiceStatus;
  q?: string;
  limit?: number;
  offset?: number;
};

export type ServiceCategorySummary = {
  id: string;
  name: string;
  businessLine: ServiceBusinessLine;
  description: string | null;
  sortOrder: number;
  status: ServiceStatus;
};

export type ServiceCategoryListQuery = {
  businessLine?: ServiceBusinessLine;
  status?: ServiceStatus;
  limit?: number;
  offset?: number;
};
