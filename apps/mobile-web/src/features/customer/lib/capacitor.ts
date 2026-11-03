export type AddressCoordinates = {
  latitude: string;
  longitude: string;
};

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

export function getCapacitorPlugin<TPlugin>(name: string): TPlugin | null {
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

export async function getCurrentAddressCoordinates(): Promise<AddressCoordinates> {
  if (typeof window === "undefined") {
    throw new Error("Location is unavailable during initial render.");
  }

  const geolocation = getCapacitorPlugin<GeolocationModule>("Geolocation");

  if (geolocation) {
    const position = await geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 30_000,
    });

    return formatAddressCoordinates(position.coords.latitude, position.coords.longitude);
  }

  if (!navigator.geolocation) {
    throw new Error("Location is unavailable on this device.");
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 30_000,
    });
  });

  return formatAddressCoordinates(position.coords.latitude, position.coords.longitude);
}

function formatAddressCoordinates(latitude: number, longitude: number): AddressCoordinates {
  return {
    latitude: formatCoordinate(latitude),
    longitude: formatCoordinate(longitude),
  };
}

function formatCoordinate(value: number): string {
  return Number.isFinite(value)
    ? value.toFixed(7).replace(/\.?0+$/, "")
    : "";
}
