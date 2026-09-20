export type TenantCustomerStatus = "active" | "disabled";

export type TenantCustomerSort =
  | "created_desc"
  | "created_asc"
  | "name_asc"
  | "name_desc";

export type TenantCustomerSummary = {
  id: string;
  customerAccountId: string;
  accountName: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: TenantCustomerStatus;
  createdAt: string;
};

export type TenantCustomerAccountSort =
  | "created_desc"
  | "created_asc"
  | "name_asc"
  | "name_desc";

export type TenantCustomerAccountSummary = {
  id: string;
  accountName: string;
  phone: string | null;
  email: string | null;
  status: TenantCustomerStatus;
  customerCount: number;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type TenantCustomerAccountDetail = TenantCustomerAccountSummary;

export type TenantCustomerAccountListQuery = {
  q?: string;
  status?: TenantCustomerStatus;
  sort?: TenantCustomerAccountSort;
  limit?: number;
  offset?: number;
};

export type TenantCustomerAccountListResponse = {
  data: TenantCustomerAccountSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type TenantCustomerAccountOverview = {
  totalAccounts: number;
  activeAccounts: number;
  disabledAccounts: number;
  linkedCustomers: number;
};

export type TenantCustomerAccountCustomersQuery = {
  q?: string;
  status?: TenantCustomerStatus;
  limit?: number;
  offset?: number;
};

export type TenantCustomerAccountCustomersResponse = {
  data: TenantCustomerSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type UpdateTenantCustomerAccountRequest = {
  accountName?: string;
  phone?: string | null;
  email?: string | null;
  status?: TenantCustomerStatus;
  version: number;
};

export type TenantCustomerDetail = TenantCustomerSummary & {
  userId: string | null;
  relationship: string | null;
  address: string | null;
  notes: string | null;
  updatedAt: string;
  version: number;
  account: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    status: TenantCustomerStatus;
    createdAt: string;
    updatedAt: string;
  };
};

export type UpdateTenantCustomerRequest = {
  fullName?: string;
  phone?: string | null;
  email?: string | null;
  relationship?: string | null;
  address?: string | null;
  notes?: string | null;
  status?: TenantCustomerStatus;
  version: number;
};

export type TenantCustomerTimelineKind = "system" | "comment";
export type TenantCustomerTimelineSource =
  | "customer"
  | "customer_account"
  | "comment"
  | "synthetic";
export type TenantCustomerTimelineDataValue = string | number | boolean | null;

export type TenantCustomerCommentMention = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
};

export type TenantCustomerCommentAttachment = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  downloadUrl: string;
  expiresAt: string;
};

export type TenantCustomerCommentAttachmentInput = {
  objectKey: string;
  fileName: string;
};

export type TenantCustomerTimelineItem = {
  id: string;
  kind: TenantCustomerTimelineKind;
  source: TenantCustomerTimelineSource;
  eventType: string;
  actorUserId: string | null;
  actorDisplayName: string | null;
  actorAvatarUrl: string | null;
  data: Record<string, TenantCustomerTimelineDataValue>;
  body: string | null;
  editedAt: string | null;
  version: number | null;
  mentions: TenantCustomerCommentMention[];
  attachments: TenantCustomerCommentAttachment[];
  canEdit: boolean;
  canDelete: boolean;
  occurredAt: string;
};

export type TenantCustomerTimelineQuery = {
  cursor?: string;
  limit?: number;
};

export type TenantCustomerTimelineResponse = {
  data: TenantCustomerTimelineItem[];
  nextCursor: string | null;
};

export type CreateTenantCustomerCommentRequest = {
  body: string;
  idempotencyKey: string;
  mentionedUserIds?: string[];
  attachments?: TenantCustomerCommentAttachmentInput[];
};

export type UpdateTenantCustomerCommentRequest = {
  body: string;
  version: number;
  mentionedUserIds?: string[];
};

export type DeleteTenantCustomerCommentRequest = { version: number };

export type TenantCustomerAttachmentUploadRequest = {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  sizeBytes: number;
};

export type TenantCustomerAttachmentUploadTicket = {
  objectKey: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
};

export type TenantCustomerListQuery = {
  q?: string;
  status?: TenantCustomerStatus;
  branchId?: string;
  createdAfter?: string;
  createdBefore?: string;
  sort?: TenantCustomerSort;
  limit?: number;
  offset?: number;
};

export type TenantCustomerListResponse = {
  data: TenantCustomerSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type TenantCustomerOverviewQuery = {
  branchId?: string;
  createdAfter?: string;
  createdBefore?: string;
};

export type TenantCustomerOverview = {
  totalCustomers: number;
  activeCustomers: number;
  disabledCustomers: number;
  linkedAccounts: number;
};

export type ResetTenantCustomerAccountPasswordResponse = {
  accountId: string;
  temporaryPassword: string;
};
