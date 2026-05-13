"use client";

import { Button, toast } from "@cleanhub/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { webAdminApi } from "@/lib/api-client";

type LogoutButtonProps = {
  className?: string;
};

export function LogoutButton({ className }: LogoutButtonProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleLogout() {
    setSubmitting(true);

    try {
      await webAdminApi.auth.logout();
      toast.success("Signed out.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to sign out cleanly.";
      toast.error(message);
    } finally {
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
      {submitting ? "Signing out..." : "Sign out"}
    </Button>
  );
}
