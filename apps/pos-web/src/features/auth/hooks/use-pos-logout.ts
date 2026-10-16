"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { posRoutes } from "@/config/routes";
import { posApi } from "@/lib/api-client";
import { posToast as toast } from "@/lib/pos-toast";
import {
  buildPosLoginPath,
  savePosLockReturnState,
} from "@/lib/pos-return-path";

type PosLogoutMessages = {
  successMessage?: string;
  failureMessage?: string;
};

/**
 * Single source of truth for signing the current cashier out of the terminal.
 *
 * Used by the header lock button / account-menu logout (LogoutButton) and by
 * the idle auto lock (PosIdleLock), so "lock" always means the same thing:
 * clear the auth session via the API, then return to the PIN login screen.
 */
export function usePosLogout() {
  const router = useRouter();
  const { userId } = usePosRuntimeConfig();
  const [submitting, setSubmitting] = useState(false);

  const logout = useCallback(
    async ({
      successMessage = "已退出登录",
      failureMessage,
    }: PosLogoutMessages = {}) => {
      const returnPath =
        typeof window === "undefined"
          ? posRoutes.home
          : `${window.location.pathname}${window.location.search}${window.location.hash}`;
      savePosLockReturnState(userId, returnPath);
      setSubmitting(true);

      try {
        await posApi.auth.logout();
        toast.success(successMessage);
      } catch (error) {
        const message =
          failureMessage ??
          (error instanceof Error ? error.message : "退出登录失败，请重试。");
        toast.error(message);
      } finally {
        router.replace(buildPosLoginPath(returnPath, { locked: true }));
        router.refresh();
        setSubmitting(false);
      }
    },
    [router, userId],
  );

  return { logout, submitting };
}
