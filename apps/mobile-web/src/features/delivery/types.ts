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
import type { TranslationKey } from "@cleanhub/i18n";
import type { QueuedUploadableMedia } from "./lib/media-upload";

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
      request:
        | MobileUploadDeliveryProofRequest
        | Omit<MobileUploadDeliveryProofRequest, "mediaRef">;
      media?: QueuedUploadableMedia;
      uploadedMediaRef?: string;
    }
  | {
      kind: "signature";
      taskId: string;
      request:
        | MobileSignDeliveryTaskRequest
        | Omit<MobileSignDeliveryTaskRequest, "signatureMediaRef">;
      media?: QueuedUploadableMedia;
      uploadedMediaRef?: string;
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
  message?: string;
  messageKey?: TranslationKey;
  warningKey?: TranslationKey;
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
