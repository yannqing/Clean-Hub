"use client";

import { cn } from "@cleanhub/ui";
import { useTranslation } from "@cleanhub/i18n/react";

import { Icon } from "@/components/app-shell/icons";

import { useOfflineSync } from "./offline-sync-provider";

type OfflineSyncBadgeProps = {
  className?: string;
  variant?: "default" | "dark";
};

export function OfflineSyncBadge({
  className,
  variant = "default",
}: OfflineSyncBadgeProps = {}) {
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

  const badgeClassName = cn(
    "items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2",
    variant === "dark"
      ? "flex size-9 px-0 text-white/75 hover:bg-white/10 hover:text-white focus-visible:ring-white/60"
      : "hidden h-9 px-3 2xl:flex",
    variant === "default" &&
      status === "synced" &&
      "bg-emerald-50 text-emerald-700",
    variant === "default" &&
      status === "offline" &&
      "bg-muted text-muted-foreground",
    variant === "default" &&
      (status === "pending" || status === "replaying") &&
      "bg-amber-50 text-amber-700",
    variant === "default" && status === "error" && "bg-red-50 text-red-700",
    variant === "default" && "focus-visible:ring-ring",
    className,
  );

  if (retryable) {
    return (
      <button
        aria-label={`${label}. ${t("pos.shell.syncRetry")}`}
        className={badgeClassName}
        onClick={() => void retry()}
        title={error ?? t("pos.shell.syncRetry")}
        type="button"
      >
        <Icon
          className="h-4 w-4"
          name={status === "error" ? "alert" : "rotate-ccw"}
        />
        {variant === "default" ? <span>{label}</span> : null}
      </button>
    );
  }

  return (
    <div
      aria-label={label}
      aria-live="polite"
      className={badgeClassName}
      title={error ?? label}
    >
      {status === "replaying" ? (
        <Icon className="h-4 w-4 animate-spin" name="rotate-ccw" />
      ) : (
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            status === "synced" ? "bg-emerald-500" : "bg-muted-foreground",
          )}
        />
      )}
      {variant === "default" ? <span>{label}</span> : null}
    </div>
  );
}
