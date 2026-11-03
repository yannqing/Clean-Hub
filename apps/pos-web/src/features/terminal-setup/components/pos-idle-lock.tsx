"use client";

import { useTranslation } from "@cleanhub/i18n/react";
import { useEffect, useRef } from "react";

import { usePosLogout } from "@/features/auth/hooks/use-pos-logout";

/**
 * User activity that keeps the terminal unlocked. Registered as passive
 * listeners so scrolling and touch interactions stay smooth on POS hardware.
 */
const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "touchstart",
  "wheel",
] as const;

/**
 * High-frequency events (wheel, rapid taps) only need a coarse activity mark.
 * Anything within this window is coalesced into a single timestamp update.
 */
const ACTIVITY_THROTTLE_MS = 1_000;

type PosIdleLockProps = {
  /**
   * Idle seconds before the terminal locks, from the terminal settings
   * (`lockTimeoutSeconds`). `null`, `0`, or negative disables auto lock.
   */
  lockTimeoutSeconds: number | null;
};

/**
 * Locks the terminal after the configured idle time by reusing the exact
 * logout flow behind the header lock button (usePosLogout). Mounted inside
 * the `(pos)` layout only, so the login page and the setup wizard are never
 * affected.
 */
export function PosIdleLock({ lockTimeoutSeconds }: PosIdleLockProps) {
  const { t } = useTranslation();
  const { logout } = usePosLogout();
  // Seeded inside the effect: reading a clock during render is impure.
  const lastActivityAtRef = useRef(0);
  const lockedRef = useRef(false);
  const logoutRef = useRef(logout);
  const translateRef = useRef(t);

  // Refs must not be written during render, so the latest callbacks are
  // mirrored after each commit. The idle effect reads them without having to
  // list them as dependencies, which would restart the timer on every render.
  useEffect(() => {
    logoutRef.current = logout;
    translateRef.current = t;
  });

  const enabled =
    typeof lockTimeoutSeconds === "number" && lockTimeoutSeconds > 0;
  const timeoutMs = enabled ? lockTimeoutSeconds * 1_000 : 0;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let timerId: number | null = null;
    let lastActivityMark = 0;

    const clearTimer = () => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
    };

    const lock = () => {
      if (lockedRef.current) {
        return;
      }
      lockedRef.current = true;
      void logoutRef.current({
        successMessage: translateRef.current("pos.shell.lockSuccess"),
        failureMessage: translateRef.current("pos.shell.lockFailed"),
      });
    };

    // Re-derives the remaining idle budget from the latest activity, then
    // either locks or schedules the next check exactly when the budget runs
    // out. Activity events only bump the timestamp; they never touch the
    // timer, so even a busy cashier session keeps one pending timeout.
    const check = () => {
      clearTimer();
      const idleForMs = Date.now() - lastActivityAtRef.current;
      if (idleForMs >= timeoutMs) {
        lock();
        return;
      }
      timerId = window.setTimeout(check, timeoutMs - idleForMs);
    };

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivityMark < ACTIVITY_THROTTLE_MS) {
        return;
      }
      lastActivityMark = now;
      lastActivityAtRef.current = now;
    };

    // Background tabs throttle timers, so the deadline can silently slip
    // past while the tab is hidden. Re-check the moment it becomes visible.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        check();
      }
    };

    lastActivityAtRef.current = Date.now();
    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, handleActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    check();

    return () => {
      clearTimer();
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, handleActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, timeoutMs]);

  return null;
}
