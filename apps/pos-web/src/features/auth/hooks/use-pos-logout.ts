"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { posRoutes } from "@/config/routes";
import { posApi } from "@/lib/api-client";
import { posToast as toast } from "@/lib/pos-toast";

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
  const [submitting, setSubmitting] = useState(false);

  const logout = useCallback(
    async ({
      successMessage = "已退出登录",
      failureMessage,
    }: PosLogoutMessages = {}) => {
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
        router.replace(posRoutes.login);
        router.refresh();
        setSubmitting(false);
      }
    },
    [router],
  );

  return { logout, submitting };
}
