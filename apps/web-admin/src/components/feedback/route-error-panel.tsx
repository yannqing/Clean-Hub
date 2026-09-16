"use client";

import { Badge, Button } from "@cleanhub/ui";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useWebAdminLocale } from "@/i18n";

/**
 * Shared body for every web-admin error boundary.
 *
 * The root boundary and the per-shell ones differ only in how much of the
 * screen they replace, so the panel itself lives here rather than being
 * copied into each `error.tsx`.
 *
 * `variant` controls that difference: "page" fills the viewport, for the root
 * boundary where the dashboard shell itself may be what failed; "section"
 * fills the content area of a shell that is still standing.
 */
type RouteErrorPanelProps = {
  error: Error & { digest?: string };
  reset: () => void;
  variant?: "page" | "section";
};

export function RouteErrorPanel({
  error,
  reset,
  variant = "page",
}: RouteErrorPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { messages } = useWebAdminLocale();
  const common = pathname.startsWith("/tenant")
    ? messages.tenant.common
    : messages.saas.common;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      className={
        variant === "page"
          ? "grid min-h-screen place-items-center bg-muted/30 px-6 py-12"
          : "grid min-h-[60vh] place-items-center px-2 py-10"
      }
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-sm">
        <Badge variant="destructive">{common.somethingWentWrong}</Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal">
          {common.somethingWentWrong}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {common.loadErrorDescription}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => reset()} type="button">
            {common.tryAgain}
          </Button>
          <Button
            onClick={() => router.refresh()}
            type="button"
            variant="outline"
          >
            {common.refresh}
          </Button>
        </div>
      </div>
    </div>
  );
}
