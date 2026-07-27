"use client";

import { cn } from "@cleanhub/ui";
import { useTranslation } from "@cleanhub/i18n/react";

import { Icon } from "@/components/app-shell/icons";

import { useOfflineSync } from "./offline-sync-provider";

export function OfflineSyncBadge() {
  const { t } = useTranslation();
  const { status, pendingCount, error, retry } = useOfflineSync();
  const retryable = status === "error" || status === "pending";
  const label =
    status === "synced"
      ? t("pos.shell.synced")
      : status === "offline"
        ? t("pos.shell.offline")
        : status === "replaying"
          ? t("pos.shell.syncReplaying")
          : status === "error"
            ? t("pos.shell.syncError")
            : t("pos.shell.syncPending", { count: pendingCount });

  const className = cn(
    "hidden h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold 2xl:flex",
    status === "synced" && "bg-emerald-50 text-emerald-700",
    status === "offline" && "bg-slate-100 text-slate-600",
    (status === "pending" || status === "replaying") &&
      "bg-amber-50 text-amber-700",
    status === "error" && "bg-red-50 text-red-700",
  );

  if (retryable) {
    return (
      <button
        aria-label={`${label}. ${t("pos.shell.syncRetry")}`}
        className={className}
        onClick={() => void retry()}
        title={error ?? t("pos.shell.syncRetry")}
        type="button"
      >
        <Icon
          className="h-4 w-4"
          name={status === "error" ? "alert" : "rotate-ccw"}
        />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div aria-live="polite" className={className} title={error ?? label}>
      {status === "replaying" ? (
        <Icon className="h-4 w-4 animate-spin" name="rotate-ccw" />
      ) : (
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            status === "synced" ? "bg-emerald-500" : "bg-slate-400",
          )}
        />
      )}
      <span>{label}</span>
    </div>
  );
}
