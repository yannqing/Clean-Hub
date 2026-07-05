"use client";

import { Button, toast } from "@cleanhub/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { webAdminRoutes } from "@/config/routes";

import { logoutBrowserSessionAction } from "../actions/browser-session.action";

type LogoutButtonProps = {
  className?: string;
  signOutLabel?: string;
  signingOutLabel?: string;
};

export function LogoutButton({
  className,
  signOutLabel = "Sign out",
  signingOutLabel = "Signing out...",
}: LogoutButtonProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleLogout() {
    setSubmitting(true);

    try {
      await logoutBrowserSessionAction();
      toast.success("Signed out.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to sign out cleanly.";
      toast.error(message);
    } finally {
      // Always return to the login page, even if the server logout failed.
      router.replace(webAdminRoutes.login);
      router.refresh();
      setSubmitting(false);
    }
  }

  return (
    <Button
      className={className}
      disabled={submitting}
      onClick={handleLogout}
      size="sm"
      type="button"
      variant="ghost"
    >
      {submitting ? signingOutLabel : signOutLabel}
    </Button>
  );
}

