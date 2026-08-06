"use client";

import { usePosLogout } from "../hooks/use-pos-logout";

type LogoutButtonProps = {
  "aria-label"?: string;
  className?: string;
  failureMessage?: string;
  signOutLabel?: string;
  signingOutLabel?: string;
  successMessage?: string;
  title?: string;
  /**
   * Optional custom trigger content (e.g. an icon). Defaults to the localized
   * sign-out / signing-out labels.
   */
  children?: React.ReactNode;
};

export function LogoutButton({
  "aria-label": ariaLabel,
  className,
  failureMessage,
  signOutLabel = "退出登录",
  signingOutLabel = "退出中…",
  successMessage = "已退出登录",
  title,
  children,
}: LogoutButtonProps) {
  const { logout, submitting } = usePosLogout();

  function handleLogout() {
    void logout({ successMessage, failureMessage });
  }

  return (
    <button
      aria-label={ariaLabel}
      className={className}
      disabled={submitting}
      onClick={handleLogout}
      title={title}
      type="button"
    >
      {children ?? (submitting ? signingOutLabel : signOutLabel)}
    </button>
  );
}
