type PreferenceStore = {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
};

export type DeliveryStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

async function getPreferenceStore(): Promise<PreferenceStore | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const preferences = await import("@capacitor/preferences");
    return preferences.Preferences;
  } catch {
    return null;
  }
}

export function createDeliveryStorage(): DeliveryStorage {
  return {
    async getItem(key) {
      const preferences = await getPreferenceStore();

      if (preferences) {
        const result = await preferences.get({ key });
        return result.value;
      }

      if (typeof window === "undefined") {
        return null;
      }

      return window.localStorage.getItem(key);
    },
    async setItem(key, value) {
      const preferences = await getPreferenceStore();

      if (preferences) {
        await preferences.set({ key, value });
        return;
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, value);
      }
    },
    async removeItem(key) {
      const preferences = await getPreferenceStore();

      if (preferences) {
        await preferences.remove({ key });
        return;
      }

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(key);
      }
    },
  };
}
