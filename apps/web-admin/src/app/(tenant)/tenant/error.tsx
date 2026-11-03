"use client";

import { RouteErrorPanel } from "@/components/feedback/route-error-panel";

/**
 * Error boundary for the tenant workspace.
 *
 * Sits beside this segment's `layout.tsx`, so a page that throws is caught
 * inside the dashboard shell: the navigation and sidebar stay usable and only
 * the content area shows the error. Without it the root boundary catches the
 * throw instead and replaces the entire app, which for a page nine segments
 * deep is a far larger blast radius than the failure warrants.
 */
type TenantErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function TenantError({ error, reset }: TenantErrorProps) {
  return <RouteErrorPanel error={error} reset={reset} variant="section" />;
}
