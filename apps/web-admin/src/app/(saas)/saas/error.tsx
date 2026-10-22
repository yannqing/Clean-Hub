"use client";

import { RouteErrorPanel } from "@/components/feedback/route-error-panel";

/**
 * Error boundary for the SaaS operator workspace.
 *
 * Sits beside this segment's `layout.tsx`, so a page that throws is caught
 * inside the dashboard shell: the navigation stays usable and only the content
 * area shows the error, instead of the root boundary replacing the whole app.
 */
type SaasErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function SaasError({ error, reset }: SaasErrorProps) {
  return <RouteErrorPanel error={error} reset={reset} variant="section" />;
}
