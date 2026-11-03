"use client";

import { useEffect } from "react";

import { verifyPosTerminalSession } from "../session-health";

/**
 * Revalidates a running terminal when an installed POS returns from the
 * background or regains connectivity. Rendering stays untouched for transient
 * network failures; only a definitive bootstrap state causes navigation.
 */
export function PosTerminalSessionGuard() {
  useEffect(() => {
    const verify = () => {
      void verifyPosTerminalSession();
    };
    const verifyAfterReconnect = () => {
      void verifyPosTerminalSession({ force: true });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        verify();
      }
    };

    const initialCheck = window.setTimeout(verify, 0);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", verify);
    window.addEventListener("online", verifyAfterReconnect);

    return () => {
      window.clearTimeout(initialCheck);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
      window.removeEventListener("pageshow", verify);
      window.removeEventListener("online", verifyAfterReconnect);
    };
  }, []);

  return null;
}
