import type {
  MobileDeliveryProofType,
  MobileDeliveryTaskStatus,
  MobileSignDeliveryTaskRequest,
  MobileUpdateDeliveryStatusRequest,
  MobileUploadDeliveryProofRequest,
} from "@cleanhub/api-client";
import { ApiNetworkError, ApiTimeoutError } from "@cleanhub/api-client";
import type { TranslationKey } from "@cleanhub/i18n";

import { apiClient } from "@/lib/api-client";
import { getOrCreateDeviceId } from "@/lib/token-storage";

import { getCurrentCoordinates, isOnline } from "../lib/device";
import { createLocalId } from "../lib/id";
import {
  queuedMediaToUploadableMedia,
  toQueuedUploadableMedia,
  uploadDeliveryMedia,
  type UploadableMedia,
} from "../lib/media-upload";
import {
  enqueueDeliveryOperation,
  getDeliveryStorageScope,
  listDeliveryQueue,
  replayDeliveryQueue,
  saveCachedDeliveryTaskDetail,
  updateQueuedDeliveryPayload,
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
  media: UploadableMedia;
  capturedAt?: string;
};

type SignatureInput = {
  taskId: string;
  signatureMedia?: UploadableMedia;
  signatureMediaRef?: string;
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

async function updateCacheFromOnlineResult(
  result: {
    task?: unknown;
  },
  scope: string,
): Promise<void> {
  if (result.task && typeof result.task === "object" && "id" in result.task) {
    await saveCachedDeliveryTaskDetail(
      result.task as DeliveryTaskDetail,
      scope,
    );
  }
}

async function assertSameDriver(scope: string) {
  if ((await getDeliveryStorageScope()) !== scope)
    throw new Error("auth.error.sessionRequired");
}

async function runOrQueue(
  scope: string,
  payload: DeliveryOfflinePayload,
  onlineOperation: () => Promise<NonNullable<DeliveryActionResult["result"]>>,
): Promise<DeliveryActionResult> {
  await assertSameDriver(scope);
  if (!isOnline()) {
    const queueItem = await enqueueDeliveryOperation(
      payload,
      {
        queuedBecause: "offline",
      },
      scope,
    );

    return {
      mode: "queued",
      queueItem,
      messageKey: "delivery.messages.offlineQueued",
    };
  }

  try {
    const result = await onlineOperation();
    await updateCacheFromOnlineResult(result, scope);

    return {
      mode: "online",
      result,
      messageKey: result.idempotent
        ? "delivery.messages.alreadySynced"
        : "delivery.messages.onlineSynced",
    };
  } catch (error) {
    if (!isOfflineError(error)) {
      throw error;
    }

    const queueItem = await enqueueDeliveryOperation(
      payload,
      {
        queuedBecause: "network-error",
        lastOnlineError: error instanceof Error ? error.message : "network",
      },
      scope,
    );

    return {
      mode: "queued",
      queueItem,
      messageKey: "delivery.messages.networkQueued",
    };
  }
}

async function applyQueuedOperation(
  payload: DeliveryOfflinePayload,
  scope: string,
): Promise<void> {
  if (payload.kind === "status") {
    await assertSameDriver(scope);
    const result = await apiClient.mobile.delivery.updateStatus(
      payload.taskId,
      payload.request,
    );
    await updateCacheFromOnlineResult(result, scope);
    return;
  }

  if (payload.kind === "proof") {
    const mediaRef =
      "mediaRef" in payload.request
        ? payload.request.mediaRef
        : payload.uploadedMediaRef
          ? payload.uploadedMediaRef
          : payload.media
            ? await uploadDeliveryMedia({
                purpose: "delivery_proof",
                taskId: payload.taskId,
                media: queuedMediaToUploadableMedia(payload.media),
              })
            : undefined;

    if (!mediaRef) {
      throw new Error("delivery.messages.queuedProofMissing");
    }

    await assertSameDriver(scope);
    const result = await apiClient.mobile.delivery.uploadProof(payload.taskId, {
      ...payload.request,
      mediaRef,
    });
    await updateCacheFromOnlineResult(result, scope);
    return;
  }

  const signatureMediaRef =
    "signatureMediaRef" in payload.request
      ? payload.request.signatureMediaRef
      : payload.uploadedMediaRef
        ? payload.uploadedMediaRef
        : payload.media
          ? await uploadDeliveryMedia({
              purpose: "delivery_signature",
              taskId: payload.taskId,
              media: queuedMediaToUploadableMedia(payload.media),
            })
          : undefined;

  if (!signatureMediaRef) {
    throw new Error("delivery.messages.queuedSignatureMissing");
  }

  await assertSameDriver(scope);
  const result = await apiClient.mobile.delivery.signTask(payload.taskId, {
    ...payload.request,
    signatureMediaRef,
  });
  await updateCacheFromOnlineResult(result, scope);
}

async function applyQueuedOperationItem(
  item: DeliveryQueueSummary["items"][number],
  scope: string,
): Promise<void> {
  await assertSameDriver(scope);
  const payload = item.payload;

  if (payload.kind === "proof" && !("mediaRef" in payload.request)) {
    let mediaRef = payload.uploadedMediaRef;

    if (!mediaRef && payload.media) {
      mediaRef = await uploadDeliveryMedia({
        purpose: "delivery_proof",
        taskId: payload.taskId,
        media: queuedMediaToUploadableMedia(payload.media),
      });
      await updateQueuedDeliveryPayload(
        item.id,
        (currentPayload) =>
          currentPayload.kind === "proof"
            ? { ...currentPayload, uploadedMediaRef: mediaRef }
            : currentPayload,
        scope,
      );
    }

    if (!mediaRef) {
      throw new Error("delivery.messages.queuedProofMissing");
    }

    await assertSameDriver(scope);
    const result = await apiClient.mobile.delivery.uploadProof(payload.taskId, {
      ...payload.request,
      mediaRef,
    });
    await updateCacheFromOnlineResult(result, scope);
    return;
  }

  if (
    payload.kind === "signature" &&
    !("signatureMediaRef" in payload.request)
  ) {
    let signatureMediaRef = payload.uploadedMediaRef;

    if (!signatureMediaRef && payload.media) {
      signatureMediaRef = await uploadDeliveryMedia({
        purpose: "delivery_signature",
        taskId: payload.taskId,
        media: queuedMediaToUploadableMedia(payload.media),
      });
      await updateQueuedDeliveryPayload(
        item.id,
        (currentPayload) =>
          currentPayload.kind === "signature"
            ? { ...currentPayload, uploadedMediaRef: signatureMediaRef }
            : currentPayload,
        scope,
      );
    }

    if (!signatureMediaRef) {
      throw new Error("delivery.messages.queuedSignatureMissing");
    }

    await assertSameDriver(scope);
    await assertSameDriver(scope);
    const result = await apiClient.mobile.delivery.signTask(payload.taskId, {
      ...payload.request,
      signatureMediaRef,
    });
    await updateCacheFromOnlineResult(result, scope);
    return;
  }

  await applyQueuedOperation(payload, scope);
}

export async function updateDeliveryStatus(
  input: StatusInput,
): Promise<
  DeliveryActionResult & { gpsWarning?: string; gpsWarningKey?: TranslationKey }
> {
  const scope = await getDeliveryStorageScope();
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

  const actionResult = await runOrQueue(scope, payload, () =>
    apiClient.mobile.delivery.updateStatus(input.taskId, request),
  );

  return {
    ...actionResult,
    gpsWarning: gps.warning,
    gpsWarningKey: gps.warningKey,
  };
}

export async function uploadDeliveryProof(
  input: ProofInput,
): Promise<DeliveryActionResult> {
  const scope = await getDeliveryStorageScope();
  if (!input.media) {
    throw new Error("delivery.messages.proofMediaRequired");
  }

  const request: Omit<MobileUploadDeliveryProofRequest, "mediaRef"> = {
    type: input.type,
    idempotencyKey: createLocalId(),
    capturedAt: input.capturedAt,
    deviceId: await getOrCreateDeviceId(),
  };
  const payload: DeliveryOfflinePayload = {
    kind: "proof",
    taskId: input.taskId,
    request,
    media: await toQueuedUploadableMedia(input.media!),
  };

  return runOrQueue(scope, payload, async () => {
    const mediaRef = await uploadDeliveryMedia({
      purpose: "delivery_proof",
      taskId: input.taskId,
      media: input.media!,
    });

    await assertSameDriver(scope);
    return apiClient.mobile.delivery.uploadProof(input.taskId, {
      ...request,
      mediaRef,
    });
  });
}

export async function signDeliveryTask(
  input: SignatureInput,
): Promise<
  DeliveryActionResult & { gpsWarning?: string; gpsWarningKey?: TranslationKey }
> {
  const scope = await getDeliveryStorageScope();
  const [deviceId, gps] = await Promise.all([
    getOrCreateDeviceId(),
    getCurrentCoordinates(),
  ]);
  if (!input.signatureMedia && !input.signatureMediaRef?.trim()) {
    throw new Error("delivery.messages.signatureMediaRequired");
  }

  const request: Omit<MobileSignDeliveryTaskRequest, "signatureMediaRef"> =
    withCoordinates(
      {
        idempotencyKey: createLocalId(),
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
    media: input.signatureMedia
      ? await toQueuedUploadableMedia(input.signatureMedia)
      : undefined,
  };

  const actionResult = await runOrQueue(scope, payload, async () => {
    const signatureMediaRef =
      input.signatureMediaRef?.trim() ||
      (await uploadDeliveryMedia({
        purpose: "delivery_signature",
        taskId: input.taskId,
        media: input.signatureMedia!,
      }));

    await assertSameDriver(scope);
    return apiClient.mobile.delivery.signTask(input.taskId, {
      ...request,
      signatureMediaRef,
    });
  });

  return {
    ...actionResult,
    gpsWarning: gps.warning,
    gpsWarningKey: gps.warningKey,
  };
}

export async function getDeliveryQueueSummary(): Promise<DeliveryQueueSummary> {
  return listDeliveryQueue();
}

export async function replayPendingDeliveryOperations(): Promise<DeliveryReplaySummary> {
  return replayDeliveryQueue(applyQueuedOperationItem);
}
