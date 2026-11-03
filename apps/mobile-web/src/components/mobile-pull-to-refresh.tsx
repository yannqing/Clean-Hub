"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, RefreshCw } from "lucide-react";

const TRIGGER_DISTANCE = 72;
const MAX_PULL_DISTANCE = 104;

export function MobilePullToRefresh({
  children,
  isRefreshing,
  label,
  onRefresh,
}: {
  children: React.ReactNode;
  isRefreshing: boolean;
  label: string;
  onRefresh: () => Promise<unknown> | void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(isRefreshing);
  const wasRefreshingRef = useRef(isRefreshing);
  const [pullDistance, setPullDistance] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [showComplete, setShowComplete] = useState(false);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  useEffect(() => {
    refreshingRef.current = isRefreshing;
    const didFinish = wasRefreshingRef.current && !isRefreshing;
    wasRefreshingRef.current = isRefreshing;
    if (!didFinish) return;

    const updateTimer = window.setTimeout(() => {
      setLastUpdatedAt(new Date());
      setShowComplete(true);
    }, 0);
    const hideTimer = window.setTimeout(() => setShowComplete(false), 900);
    return () => {
      window.clearTimeout(updateTimer);
      window.clearTimeout(hideTimer);
    };
  }, [isRefreshing]);

  const finishPull = useCallback(() => {
    touchStartRef.current = null;
    if (pullDistanceRef.current >= TRIGGER_DISTANCE && !refreshingRef.current) {
      setPullDistance(TRIGGER_DISTANCE);
      void Promise.resolve(onRefresh()).finally(() => setPullDistance(0));
      return;
    }
    setPullDistance(0);
  }, [onRefresh]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const handleTouchStart = (event: TouchEvent) => {
      if (window.scrollY <= 0 && !refreshingRef.current) {
        touchStartRef.current = event.touches[0]?.clientY ?? null;
      }
    };
    const handleTouchMove = (event: TouchEvent) => {
      const start = touchStartRef.current;
      const current = event.touches[0]?.clientY;
      if (start === null || current === undefined || window.scrollY > 0) return;
      const distance = Math.max(0, Math.min(MAX_PULL_DISTANCE, (current - start) * 0.55));
      if (distance > 0) event.preventDefault();
      setPullDistance(distance);
    };
    const handleTouchEnd = () => finishPull();

    root.addEventListener("touchstart", handleTouchStart, { passive: true });
    root.addEventListener("touchmove", handleTouchMove, { passive: false });
    root.addEventListener("touchend", handleTouchEnd, { passive: true });
    root.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    return () => {
      root.removeEventListener("touchstart", handleTouchStart);
      root.removeEventListener("touchmove", handleTouchMove);
      root.removeEventListener("touchend", handleTouchEnd);
      root.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [finishPull]);

  const visible = pullDistance > 0 || isRefreshing || showComplete;
  const ready = pullDistance >= TRIGGER_DISTANCE;
  const timeLabel = lastUpdatedAt
    ? lastUpdatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div ref={rootRef} className="mobile-pull-root">
      <div
        aria-live="polite"
        className={`mobile-refresh-indicator ${visible ? "is-visible" : ""}`}
        style={{ opacity: visible ? 1 : 0 }}
      >
        {showComplete && !isRefreshing ? (
          <Check className="size-4 text-emerald-600" aria-hidden />
        ) : isRefreshing ? (
          <Loader2 className="size-4 animate-spin text-blue-600" aria-hidden />
        ) : (
          <RefreshCw
            className={`size-4 text-blue-600 transition-transform ${ready ? "rotate-180" : ""}`}
            aria-hidden
          />
        )}
        <span>{label}</span>
        <span className="text-slate-400">{timeLabel}</span>
      </div>
      <div
        className="transition-transform duration-200"
        style={{ transform: pullDistance ? `translateY(${Math.min(pullDistance, 48)}px)` : undefined }}
      >
        {children}
      </div>
    </div>
  );
}
