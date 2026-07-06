"use client";

import { posToast as toast } from "@/lib/pos-toast";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { posRoutes } from "@/config/routes";
import { posApi } from "@/lib/api-client";

type LogoutButtonProps = {
  className?: string;
  signOutLabel?: string;
  signingOutLabel?: string;
  /**
   * Optional custom trigger content (e.g. an icon). Defaults to the localized
   * sign-out / signing-out labels.
   */
  children?: React.ReactNode;
};

export function LogoutButton({
  className,
  signOutLabel = "退出登录",
  signingOutLabel = "退出中…",
  children,
}: LogoutButtonProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleLogout() {
    setSubmitting(true);

    try {
      await posApi.auth.logout();
      toast.success("已退出登录");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "退出登录失败，请重试。";
      toast.error(message);
    } finally {
      router.replace(posRoutes.login);
      router.refresh();
      setSubmitting(false);
    }
  }

  return (
    <button
      className={className}
      disabled={submitting}
      onClick={handleLogout}
      type="button"
    >
      {children ?? (submitting ? signingOutLabel : signOutLabel)}
    </button>
  );
}
