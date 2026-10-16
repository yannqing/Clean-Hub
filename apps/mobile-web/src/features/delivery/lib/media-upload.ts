import type { MobileMediaPurpose } from "@cleanhub/api-client";

import { apiClient } from "@/lib/api-client";

export type UploadableMedia = {
  blob: Blob;
  contentType: string;
  capturedAt?: string;
};

export type QueuedUploadableMedia = {
  dataUrl: string;
  contentType: string;
  capturedAt?: string;
};

export async function uploadDeliveryMedia(input: {
  purpose: MobileMediaPurpose;
  taskId: string;
  media: UploadableMedia;
}): Promise<string> {
  const ticket = await apiClient.mobile.media.requestUpload({
    purpose: input.purpose,
    contentType: input.media.contentType,
    sizeBytes: input.media.blob.size,
    entityId: input.taskId,
  });

  const response = await fetch(ticket.uploadUrl, {
    method: "PUT",
    headers: ticket.headers,
    body: input.media.blob,
  });

  if (!response.ok) {
    throw new Error("delivery.messages.mediaUploadFailed");
  }

  return ticket.objectKey;
}

export function dataUrlToUploadableMedia(
  dataUrl: string,
  capturedAt?: string,
): UploadableMedia {
  const [metadata, base64] = dataUrl.split(",");
  const contentType = metadata?.match(/^data:([^;]+);base64$/)?.[1];

  if (!contentType || !base64) {
    throw new Error("delivery.messages.invalidMediaData");
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return {
    blob: new Blob([bytes], { type: contentType }),
    contentType,
    capturedAt,
  };
}

export function queuedMediaToUploadableMedia(
  media: QueuedUploadableMedia,
): UploadableMedia {
  return dataUrlToUploadableMedia(media.dataUrl, media.capturedAt);
}

export function uploadableMediaToDataUrl(
  media: UploadableMedia,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("delivery.messages.mediaEncodeFailed"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("delivery.messages.mediaEncodeFailed"));
    reader.readAsDataURL(media.blob);
  });
}

export async function toQueuedUploadableMedia(
  media: UploadableMedia,
): Promise<QueuedUploadableMedia> {
  return {
    dataUrl: await uploadableMediaToDataUrl(media),
    contentType: media.contentType,
    capturedAt: media.capturedAt,
  };
}
