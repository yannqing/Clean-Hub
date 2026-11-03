import { Capacitor, registerPlugin } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

type NativeCredentialStore = {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
};

const native = registerPlugin<NativeCredentialStore>("SecureStorage");
const pending = new Map<string, Promise<unknown>>();

function serialize<T>(key: string, action: () => Promise<T>): Promise<T> {
  const result = (pending.get(key) ?? Promise.resolve()).then(action, action);
  pending.set(key, result);
  void result
    .finally(() => {
      if (pending.get(key) === result) pending.delete(key);
    })
    .catch(() => undefined);
  return result;
}

/** Native credentials never fall back to Preferences if the secure bridge fails.
 * Browser development retains PreferencesWeb; this static app is not a web login.
 * An upgrade migrates the old value only after the secure write succeeds. */
export const credentialStorage = {
  getItem(key: string): Promise<string | null> {
    return serialize(key, async () => {
      if (typeof window === "undefined") return null;
      if (!Capacitor.isNativePlatform())
        return (await Preferences.get({ key })).value;
      const { value } = await native.get({ key });
      const legacy =
        (await Preferences.get({ key })).value ??
        window.localStorage.getItem(key);
      if (value === null && legacy !== null)
        await native.set({ key, value: legacy });
      await Preferences.remove({ key });
      window.localStorage.removeItem(key);
      return value ?? legacy;
    });
  },
  setItem(key: string, value: string): Promise<void> {
    return serialize(key, async () => {
      if (typeof window === "undefined") return;
      if (!Capacitor.isNativePlatform()) return Preferences.set({ key, value });
      await native.set({ key, value });
      await Preferences.remove({ key });
      window.localStorage.removeItem(key);
    });
  },
  removeItem(key: string): Promise<void> {
    return serialize(key, async () => {
      if (typeof window === "undefined") return;
      if (Capacitor.isNativePlatform()) await native.remove({ key });
      await Preferences.remove({ key });
      window.localStorage.removeItem(key);
    });
  },
};
