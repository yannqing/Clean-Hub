import type {
  MobileDeliveryProofType,
  MobileDeliveryTaskStatus,
  MobileSignDeliveryTaskRequest,
  MobileUpdateDeliveryStatusRequest,
  MobileUploadDeliveryProofRequest,
} from "@cleanhub/api-client";
import { ApiNetworkError, ApiTimeoutError } from "@cleanhub/api-client";

import { apiClient } from "@/lib/api-client";
import { getOrCreateDeviceId } from "@/lib/token-storage";

import { getCurrentCoordinates, isOnline } from "../lib/device";
import { createLocalId } from "../lib/id";
import {
  enqueueDeliveryOperation,
  listDeliveryQueue,
  replayDeliveryQueue,
  saveCachedDeliveryTaskDetail,
} from "../lib/offline-store";
import type {
  DeliveryActionResult,
  DeliveryCoordinates,
  DeliveryTaskDetail,
  DeliveryOfflinePayload,
  DeliveryQueueSummary,
  DeliveryReplaySummary,
} from "../types";

type StatusInput = {
  taskId: string;
  toStatus: MobileDeliveryTaskStatus;
  note?: string;
  exceptionReason?: string;
};

type ProofInput = {
  taskId: string;
  type: Exclude<MobileDeliveryProofType, "signature">;
  base64?: string;
  mediaRef?: string;
  mimeType?: string;
  capturedAt?: string;
};

type SignatureInput = {
  taskId: string;
  signatureBase64?: string;
  signatureMediaRef?: string;
  mimeType?: string;
  capturedAt?: string;
  signedByName?: string;
};

function isOfflineError(error: unknown): boolean {
  return (
    error instanceof ApiNetworkError ||
    error instanceof ApiTimeoutError ||
    (!isOnline() && error instanceof Error)
  );
}

function withCoordinates<TRequest extends Record<string, unknown>>(
  request: TRequest,
  coordinates: DeliveryCoordinates | null,
): TRequest {
  if (!coordinates) {
    return request;
  }

  return {
    ...request,
    lat: coordinates.lat,
    lng: coordinates.lng,
  };
}

async function updateCacheFromOnlineResult(result: {
  task?: unknown;
}): Promise<void> {
  if (result.task && typeof result.task === "object" && "id" in result.task) {
    await saveCachedDeliveryTaskDetail(result.task as DeliveryTaskDetail);
  }
}

async function runOrQueue(
  payload: DeliveryOfflinePayload,
  onlineOperation: () => Promise<NonNullable<DeliveryActionResult["result"]>>,
): Promise<DeliveryActionResult> {
  if (!isOnline()) {
    const queueItem = await enqueueDeliveryOperation(payload, {
      queuedBecause: "offline",
    });

    return {
      mode: "queued",
      queueItem,
      message: "Action enregistrée hors ligne. Elle sera synchronisée automatiquement.",
    };
  }

  try {
    const result = await onlineOperation();
    await updateCacheFromOnlineResult(result);

    return {
      mode: "online",
      result,
      message: result.idempotent
        ? "Action déjà synchronisée."
        : "Action synchronisée.",
    };
  } catch (error) {
    if (!isOfflineError(error)) {
      throw error;
    }

    const queueItem = await enqueueDeliveryOperation(payload, {
      queuedBecause: "network-error",
      lastOnlineError: error instanceof Error ? error.message : "network",
    });

    return {
      mode: "queued",
      queueItem,
      message: "Réseau indisponible. Action placée en attente de synchronisation.",
    };
  }
}

async function applyQueuedOperation(payload: DeliveryOfflinePayload): Promise<void> {
  if (payload.kind === "status") {
    const result = await apiClient.mobile.delivery.updateStatus(
      payload.taskId,
      payload.request,
    );
    await updateCacheFromOnlineResult(result);
    return;
  }

  if (payload.kind === "proof") {
    const result = await apiClient.mobile.delivery.uploadProof(
      payload.taskId,
      payload.request,
    );
    await updateCacheFromOnlineResult(result);
    return;
  }

  const result = await apiClient.mobile.delivery.signTask(
    payload.taskId,
    payload.request,
  );
  await updateCacheFromOnlineResult(result);
}

export async function updateDeliveryStatus(
  input: StatusInput,
): Promise<DeliveryActionResult & { gpsWarning?: string }> {
  const [deviceId, gps] = await Promise.all([
    getOrCreateDeviceId(),
    getCurrentCoordinates(),
  ]);
  const request: MobileUpdateDeliveryStatusRequest = withCoordinates(
    {
      toStatus: input.toStatus,
      idempotencyKey: createLocalId(),
      deviceId,
      note: input.note?.trim() || undefined,
      exceptionReason: input.exceptionReason?.trim() || undefined,
    },
    gps.coordinates,
  );
  const payload: DeliveryOfflinePayload = {
    kind: "status",
    taskId: input.taskId,
    request,
  };

  const actionResult = await runOrQueue(payload, () =>
    apiClient.mobile.delivery.updateStatus(input.taskId, request),
  );

  return {
    ...actionResult,
    gpsWarning: gps.warning,
  };
}

export async function uploadDeliveryProof(
  input: ProofInput,
): Promise<DeliveryActionResult> {
  const request: MobileUploadDeliveryProofRequest = {
    type: input.type,
    idempotencyKey: createLocalId(),
    base64: input.base64,
    mediaRef: input.mediaRef?.trim() || undefined,
    mimeType: input.mimeType,
    capturedAt: input.capturedAt,
    deviceId: await getOrCreateDeviceId(),
  };
  const payload: DeliveryOfflinePayload = {
    kind: "proof",
    taskId: input.taskId,
    request,
  };

  return runOrQueue(payload, () =>
    apiClient.mobile.delivery.uploadProof(input.taskId, request),
  );
}

export async function signDeliveryTask(
  input: SignatureInput,
): Promise<DeliveryActionResult & { gpsWarning?: string }> {
  const [deviceId, gps] = await Promise.all([
    getOrCreateDeviceId(),
    getCurrentCoordinates(),
  ]);
  const request: MobileSignDeliveryTaskRequest = withCoordinates(
    {
      idempotencyKey: createLocalId(),
      signatureBase64: input.signatureBase64,
      signatureMediaRef: input.signatureMediaRef?.trim() || undefined,
      mimeType: input.mimeType,
      capturedAt: input.capturedAt,
      signedByName: input.signedByName?.trim() || undefined,
      deviceId,
    },
    gps.coordinates,
  );
  const payload: DeliveryOfflinePayload = {
    kind: "signature",
    taskId: input.taskId,
    request,
  };

  const actionResult = await runOrQueue(payload, () =>
    apiClient.mobile.delivery.signTask(input.taskId, request),
  );

  return {
    ...actionResult,
    gpsWarning: gps.warning,
  };
}

export async function getDeliveryQueueSummary(): Promise<DeliveryQueueSummary> {
  return listDeliveryQueue();
}

export async function replayPendingDeliveryOperations(): Promise<DeliveryReplaySummary> {
  return replayDeliveryQueue((item) => applyQueuedOperation(item.payload));
}
