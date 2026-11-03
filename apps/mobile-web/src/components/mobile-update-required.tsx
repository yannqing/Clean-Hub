"use client";

import { useTranslation } from "@cleanhub/i18n/react";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { createDeliveryStorage } from "@/features/delivery/lib/storage";

import {
  mobileReleaseConfig,
  compareSemver,
} from "@/lib/mobile-release-config";

type VersionPolicy = {
  minimumVersion: string;
  updateUrl: string | null;
  version: number;
};
function validPolicy(value: unknown): value is VersionPolicy {
  if (!value || typeof value !== "object") return false;
  const policy = value as VersionPolicy;
  if (!/^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(policy.minimumVersion)) return false;
  if (!policy.updateUrl) return policy.minimumVersion === "0.0.0";
  try {
    const url = new URL(policy.updateUrl);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function MobileUpdateRequired() {
  const { t } = useTranslation();
  const [policy, setPolicy] = useState<VersionPolicy>({
    minimumVersion: mobileReleaseConfig.minSupportedVersion,
    updateUrl: mobileReleaseConfig.updateUrl,
    version: 0,
  });
  useEffect(() => {
    let active = true;
    let loading = false;
    const storage = createDeliveryStorage();
    void storage
      .getItem("cleanhub.mobile.version-policy")
      .then((raw) => {
        if (raw && active) {
          try {
            const cached: unknown = JSON.parse(raw);
            if (validPolicy(cached)) setPolicy(cached);
          } catch {
            /* Refetch malformed cache. */
          }
        }
      })
      .catch(() => undefined)
      .finally(() => void refresh());
    async function refresh() {
      if (loading || document.visibilityState !== "visible") return;
      loading = true;
      try {
        const result = await apiClient.mobile.auth.getReleasePolicy({
          timeoutMs: 10_000,
          cache: "no-store",
        });
        if (validPolicy(result) && active) {
          setPolicy(result);
          await storage.setItem(
            "cleanhub.mobile.version-policy",
            JSON.stringify(result),
          );
        }
      } catch {
        /* Keep the last validated policy while offline. */
      } finally {
        loading = false;
      }
    }
    const check = () => void refresh();
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    const timer = window.setInterval(check, 5 * 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  if (
    compareSemver(mobileReleaseConfig.appVersion, policy.minimumVersion) >= 0
  ) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/85 px-5">
      <section className="w-full max-w-sm rounded-lg bg-white p-5 text-zinc-950 shadow-xl">
        <h1 className="text-lg font-semibold">
          {t("common.update.requiredTitle")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-700">
          {t("common.update.requiredBody")}
        </p>
        <a
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          href={policy.updateUrl ?? mobileReleaseConfig.updateUrl}
        >
          {t("common.update.install")}
        </a>
      </section>
    </div>
  );
}
