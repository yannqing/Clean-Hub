"use client";

import { cn } from "@cleanhub/ui";
import { useTranslation } from "@cleanhub/i18n/react";

import { Icon } from "@/components/app-shell/icons";

import { usePosTerminalRealtime } from "@/features/realtime/components";

type OfflineSyncBadgeProps = {
  className?: string;
  variant?: "default" | "dark";
};

export function OfflineSyncBadge({
  className,
  variant = "default",
}: OfflineSyncBadgeProps = {}) {
  const { t } = useTranslation();
  const {
    operationalStatus: status,
    pendingSalesCount,
    pendingOperationsCount,
    error,
    retry,
  } = usePosTerminalRealtime();
  const retryable = [
    "sync_error",
    "degraded",
    "offline_pending",
    "offline",
  ].includes(status);
  const visibleLabel = (() => {
    switch (status) {
      case "online":
        return t("pos.shell.online");
      case "connecting":
      case "unknown":
        return t("pos.shell.connecting");
      case "degraded":
        return t("pos.shell.connectionDegraded");
      case "synchronizing":
        return t("pos.shell.synchronizing");
      case "offline_pending":
        return pendingSalesCount > 0
          ? t("pos.shell.offlinePendingSales", { count: pendingSalesCount })
          : t("pos.shell.offlinePendingOperations", {
              count: pendingOperationsCount,
            });
      case "sync_error":
        return t("pos.shell.syncErrorSupport");
      case "disabled":
        return t("pos.shell.deviceDisabled");
      case "never_seen":
        return t("pos.shell.neverConnected");
      default:
        return t("pos.shell.offline");
    }
  })();

  const badgeClassName = cn(
    "items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2",
    variant === "dark"
      ? "flex size-9 px-0 text-white/75 hover:bg-white/10 hover:text-white focus-visible:ring-white/60"
      : "flex min-h-9 min-w-0 px-3 py-2 text-left",
    variant === "default" &&
      status === "online" &&
      "bg-emerald-50 text-emerald-700",
    variant === "default" &&
      (status === "offline" ||
        status === "unknown" ||
        status === "disabled" ||
        status === "never_seen") &&
      "bg-muted text-muted-foreground",
    variant === "default" &&
      (status === "degraded" || status === "offline_pending") &&
      "bg-amber-50 text-amber-700",
    variant === "default" &&
      (status === "connecting" || status === "synchronizing") &&
      "bg-blue-50 text-blue-700",
    variant === "default" &&
      status === "sync_error" &&
      "bg-red-50 text-red-700",
    variant === "default" && "focus-visible:ring-ring",
    className,
  );

  if (retryable) {
    return (
      <button
        aria-label={`${visibleLabel}. ${t("pos.shell.syncRetry")}`}
        className={badgeClassName}
        onClick={() => void retry()}
        title={error ?? t("pos.shell.syncRetry")}
        type="button"
      >
        <Icon
          className="h-4 w-4"
          name={status === "sync_error" ? "alert" : "rotate-ccw"}
        />
        {variant === "default" ? (
          <span className="min-w-0 truncate">{visibleLabel}</span>
        ) : null}
      </button>
    );
  }

  return (
    <div
      aria-label={visibleLabel}
      aria-live="polite"
      className={badgeClassName}
      title={error ?? visibleLabel}
    >
      {status === "synchronizing" || status === "connecting" ? (
        <Icon className="h-4 w-4 animate-spin" name="rotate-ccw" />
      ) : (
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            status === "online"
              ? "bg-emerald-500"
              : status === "sync_error"
                ? "bg-red-500"
                : status === "offline_pending" || status === "degraded"
                  ? "bg-amber-500"
                  : "bg-muted-foreground",
          )}
        />
      )}
      {variant === "default" ? (
        <span className="min-w-0 truncate">{visibleLabel}</span>
      ) : null}
    </div>
  );
}
