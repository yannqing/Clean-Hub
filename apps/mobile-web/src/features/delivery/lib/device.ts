import type { DeliveryCoordinates } from "../types";

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
    source: "CAMERA";
  }): Promise<{
    base64String?: string;
    format?: string;
  }>;
};

export type CapturePhotoResult = {
  base64: string;
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

function getPermissionMessage(error: unknown, capability: "gps" | "camera"): string {
  if (!error) {
    return capability === "gps"
      ? "Le module GPS natif n'est pas encore installé dans mobile-web. L'action peut partir sans position."
      : "Le module caméra natif n'est pas encore installé dans mobile-web. Ajoutez une référence manuelle pour continuer.";
  }

  return capability === "gps"
    ? "Position indisponible ou permission refusée. L'action reste possible sans GPS."
    : "Caméra indisponible ou permission refusée. Vous pouvez saisir une référence de preuve.";
}

export async function getCurrentCoordinates(): Promise<{
  coordinates: DeliveryCoordinates | null;
  warning?: string;
}> {
  if (typeof window === "undefined") {
    return {
      coordinates: null,
      warning: "GPS indisponible pendant le rendu initial.",
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
        warning: getPermissionMessage(null, "gps"),
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
      warning: getPermissionMessage(error, "gps"),
    };
  }
}

export async function captureDeliveryPhoto(): Promise<{
  photo: CapturePhotoResult | null;
  warning?: string;
}> {
  if (typeof window === "undefined") {
    return {
      photo: null,
      warning: "Caméra indisponible pendant le rendu initial.",
    };
  }

  try {
    const camera = getCapacitorPlugin<CameraModule>("Camera");

    if (!camera) {
      return {
        photo: null,
        warning: getPermissionMessage(null, "camera"),
      };
    }

    const photo = await camera.getPhoto({
      quality: 72,
      allowEditing: false,
      resultType: "base64",
      source: "CAMERA",
    });

    if (!photo.base64String) {
      return {
        photo: null,
        warning: "Aucune photo reçue depuis la caméra.",
      };
    }

    return {
      photo: {
        base64: photo.base64String,
        mimeType: `image/${photo.format ?? "jpeg"}`,
        capturedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      photo: null,
      warning: getPermissionMessage(error, "camera"),
    };
  }
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}
