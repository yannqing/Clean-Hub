import type {
  MobileDeliveryMutationResult,
  MobileDeliveryProofType,
  MobileDeliveryTaskDetail,
  MobileDeliveryTaskListItem,
  MobileDeliveryTaskStatus,
  MobileUploadDeliveryProofRequest,
  MobileSignDeliveryTaskRequest,
  MobileUpdateDeliveryStatusRequest,
} from "@cleanhub/api-client";

export type DeliveryTaskStatus = MobileDeliveryTaskStatus;
export type DeliveryTaskListItem = MobileDeliveryTaskListItem;
export type DeliveryTaskDetail = MobileDeliveryTaskDetail;
export type DeliveryProofType = MobileDeliveryProofType;
export type DeliveryMutationResult = MobileDeliveryMutationResult;

export type DeliveryCoordinates = {
  lat: number;
  lng: number;
};

export type DeliveryOfflinePayload =
  | {
      kind: "status";
      taskId: string;
      request: MobileUpdateDeliveryStatusRequest;
    }
  | {
      kind: "proof";
      taskId: string;
      request: MobileUploadDeliveryProofRequest;
    }
  | {
      kind: "signature";
      taskId: string;
      request: MobileSignDeliveryTaskRequest;
    };

export type DeliveryOfflineQueueItem = {
  id: string;
  entity: string;
  operation: "create" | "update" | "delete";
  payload: DeliveryOfflinePayload;
  idempotencyKey: string;
  status: "pending" | "synced";
  attempt: number;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
  lastError?: string;
  metadata?: Record<string, unknown>;
};

export type DeliveryActionMode = "online" | "queued";

export type DeliveryActionResult = {
  mode: DeliveryActionMode;
  result?: DeliveryMutationResult;
  queueItem?: DeliveryOfflineQueueItem;
  message: string;
};

export type DeliveryQueueSummary = {
  count: number;
  items: DeliveryOfflineQueueItem[];
};

export type DeliveryReplaySummary = {
  replayed: DeliveryOfflineQueueItem[];
  failed?: DeliveryOfflineQueueItem;
};

export type DeliveryTaskCacheSnapshot = {
  loadedAt: string;
  tasks: DeliveryTaskListItem[];
  details: Record<string, DeliveryTaskDetail>;
};
