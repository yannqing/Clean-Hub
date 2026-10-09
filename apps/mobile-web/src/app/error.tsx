"use client";

import { useTranslation } from "@cleanhub/i18n/react";
import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { EmptyState } from "@/components/empty-state";

/**
 * Route-level error boundary.
 *
 * The whole app hangs off one client component, so before this file any
 * unhandled throw left a blank white screen with no way back. This renders
 * inside the root layout, so `MobileI18nProvider` is still mounted and the
 * copy can be translated -- unlike a `global-error.tsx`, which replaces the
 * layout and would have to hardcode its text.
 */
type MobileErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function MobileError({ error, reset }: MobileErrorProps) {
  const { t } = useTranslation();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-10">
      <EmptyState
        action={
          <button
            className="inline-flex h-11 items-center justify-center rounded-md bg-slate-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
            onClick={reset}
            type="button"
          >
            {t("common.retry")}
          </button>
        }
        body={t("common.errorBody")}
        icon={TriangleAlert}
        title={t("common.errorTitle")}
      />
    </main>
  );
}
