import type { TranslationKey } from "@cleanhub/i18n";

import type { DeliveryCoordinates } from "../types";
import { compressImage } from "./image-compression";

type GeolocationModule = {
  getCurrentPosition(options?: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
  }): Promise<{
    coords: {
      latitude: number;
      longitude: number;
    };
  }>;
};

type CameraModule = {
  getPhoto(options: {
    quality?: number;
    allowEditing?: boolean;
    resultType: "base64";
    source: "CAMERA" | "PHOTOS";
  }): Promise<{
    base64String?: string;
    format?: string;
  }>;
};

export type CapturePhotoResult = {
  blob: Blob;
  contentType: string;
  mimeType: string;
  capturedAt: string;
};

function getCapacitorPlugin<TPlugin>(name: string): TPlugin | null {
  if (typeof window === "undefined") {
    return null;
  }

  const candidate = window as Window & {
    Capacitor?: {
      Plugins?: Record<string, unknown>;
    };
  };

  const plugin = candidate.Capacitor?.Plugins?.[name];
  return plugin ? (plugin as TPlugin) : null;
}

function getPermissionWarningKey(error: unknown, capability: "gps" | "camera"): TranslationKey {
  if (!error) {
    return capability === "gps"
      ? "delivery.device.gpsNativeMissing"
      : "delivery.device.cameraNativeMissing";
  }

  return capability === "gps"
    ? "delivery.device.gpsPermissionDenied"
    : "delivery.device.cameraPermissionDenied";
}

function fileToDataUrl(file: File): Promise<string> {
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
    reader.readAsDataURL(file);
  });
}

type PhotoSource = "camera" | "gallery";

function selectPhotoFile(source: PhotoSource): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");

    input.type = "file";
    input.accept = "image/*";
    if (source === "camera") {
      input.capture = "environment";
    }
    input.style.position = "fixed";
    input.style.left = "-9999px";

    const cleanup = () => {
      input.remove();
      window.removeEventListener("focus", handleFocus);
    };

    function handleFocus() {
      window.setTimeout(() => {
        if (!input.files?.length) {
          cleanup();
          resolve(null);
        }
      }, 500);
    }

    input.addEventListener(
      "change",
      () => {
        const file = input.files?.[0] ?? null;
        cleanup();
        resolve(file);
      },
      { once: true },
    );
    window.addEventListener("focus", handleFocus);
    document.body.append(input);
    input.click();
  });
}

export async function getCurrentCoordinates(): Promise<{
  coordinates: DeliveryCoordinates | null;
  warning?: string;
  warningKey?: TranslationKey;
}> {
  if (typeof window === "undefined") {
    return {
      coordinates: null,
      warningKey: "delivery.device.gpsInitialUnavailable",
    };
  }

  try {
    const geolocation = getCapacitorPlugin<GeolocationModule>("Geolocation");

    if (!geolocation) {
      if (navigator.geolocation) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10_000,
            maximumAge: 30_000,
          });
        });

        return {
          coordinates: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
        };
      }

      return {
        coordinates: null,
        warningKey: getPermissionWarningKey(null, "gps"),
      };
    }

    const position = await geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 30_000,
    });

    return {
      coordinates: {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      },
    };
  } catch (error) {
    return {
      coordinates: null,
      warningKey: getPermissionWarningKey(error, "gps"),
    };
  }
}

export async function captureDeliveryPhoto(
  source: PhotoSource = "camera",
): Promise<{
  photo: CapturePhotoResult | null;
  warning?: string;
  warningKey?: TranslationKey;
}> {
  if (typeof window === "undefined") {
    return {
      photo: null,
      warningKey: "delivery.device.cameraInitialUnavailable",
    };
  }

  try {
    const camera = getCapacitorPlugin<CameraModule>("Camera");

    if (!camera) {
      const file = await selectPhotoFile(source);

      if (file) {
        const compressed = await compressImage({
          dataUrl: await fileToDataUrl(file),
          outputType: "image/jpeg",
        });

        return {
          photo: {
            blob: compressed,
            contentType: compressed.type || "image/jpeg",
            mimeType: compressed.type || "image/jpeg",
            capturedAt: new Date().toISOString(),
          },
        };
      }

      return {
        photo: null,
        warningKey: "delivery.device.cameraNoPhoto",
      };
    }

    const photo = await camera.getPhoto({
      quality: 72,
      allowEditing: false,
      resultType: "base64",
      source: source === "gallery" ? "PHOTOS" : "CAMERA",
    });

    if (!photo.base64String) {
      return {
        photo: null,
        warningKey: "delivery.device.cameraNoPhoto",
      };
    }

    const mimeType = `image/${photo.format ?? "jpeg"}`;
    const compressed = await compressImage({
      dataUrl: `data:${mimeType};base64,${photo.base64String}`,
      outputType: "image/jpeg",
    });

    return {
      photo: {
        blob: compressed,
        contentType: compressed.type || "image/jpeg",
        mimeType: compressed.type || "image/jpeg",
        capturedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      photo: null,
      warningKey: getPermissionWarningKey(error, "camera"),
    };
  }
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}
