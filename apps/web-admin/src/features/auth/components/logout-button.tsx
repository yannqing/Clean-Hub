"use client";

import { Button, toast } from "@cleanhub/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { logoutAction } from "../actions";
import { webAdminRoutes } from "@/config/routes";

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

    const result = await logoutAction();

    if (result.ok) {
      toast.success("Signed out.");
    } else {
      toast.error(result.message);
    }

    // Always return to the login page, even if the server logout failed.
    router.replace(webAdminRoutes.login);
    router.refresh();
    setSubmitting(false);
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

