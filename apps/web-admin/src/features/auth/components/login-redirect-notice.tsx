"use client";

import { toast } from "@cleanhub/ui";
import { useEffect } from "react";

import {
  AUTH_REDIRECT_REASONS,
  AUTH_REDIRECT_REASON_PARAM,
  type AuthRedirectReason,
} from "@/config/auth-routing";
import { useWebAdminLocale } from "@/i18n";

export function LoginRedirectNotice({
  reason,
}: {
  reason?: AuthRedirectReason;
}) {
  const { messages } = useWebAdminLocale();
  const sessionExpiredMessage = messages.auth.redirect.sessionExpired;
  const tenantAccessDeniedMessage =
    messages.auth.redirect.tenantAccessDenied;

  useEffect(() => {
    if (!reason) {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.delete(AUTH_REDIRECT_REASON_PARAM);
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );

    const message =
      reason === AUTH_REDIRECT_REASONS.sessionExpired
        ? sessionExpiredMessage
        : tenantAccessDeniedMessage;

    toast.error(message, {
      id: `auth-redirect-${reason}`,
    });
  }, [reason, sessionExpiredMessage, tenantAccessDeniedMessage]);

  return null;
}
