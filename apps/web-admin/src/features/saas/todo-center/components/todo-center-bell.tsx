"use client";

import { Icon, cn } from "@cleanhub/ui";
import { Bell } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { useSaasI18n } from "@/i18n";

import { getTodoCenterQuery } from "../queries";
import { todoCenterTotal } from "../types";

/**
 * Header "My Todo" bell.
 *
 * Renders a bell icon linking to the SaaS todo dashboard (`/saas/todos`), with a
 * live count badge of total actionable items across feedback tickets, pending
 * restore requests, and high-severity security events.
 *
 * The count is fetched once on mount and refreshed when the pathname changes
 * (e.g. after an operator returns from triaging a ticket). Failures are silent:
 * a load error just leaves the previous count (or none) so a transient backend
 * issue never blocks the header. The bell link itself stays clickable regardless.
 */
export function TodoCenterBell() {
  const { m } = useSaasI18n();
  const pathname = usePathname();
  const [count, setCount] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await getTodoCenterQuery();
      setCount(todoCenterTotal(result));
    } catch {
      // Keep the previous count; the dashboard surfaces the full error, the
      // header badge should never throw.
    }
  }, []);

  // Re-fetch on mount and whenever the operator navigates, so the badge stays
  // current after triaging items elsewhere. The async fetch resolves the count
  // in a `.then` callback (not synchronously in the effect body).
  useEffect(() => {
    let isCurrent = true;

    getTodoCenterQuery()
      .then((result) => {
        if (isCurrent) {
          setCount(todoCenterTotal(result));
        }
      })
      .catch(() => {
        // Leave the previous count on failure; never block the header.
      });

    return () => {
      isCurrent = false;
    };
  }, [pathname]);

  return (
    <Link
      aria-label={m.todoCenter.openTodoCenter}
      className={cn(
        "relative inline-flex size-9 shrink-0 items-center justify-center rounded-md text-foreground transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      href={webAdminRoutes.saas.todos}
      onClick={() => void refresh()}
    >
      <Icon aria-hidden icon={Bell} />
      {count != null && count > 0 ? (
        <span
          aria-hidden
          className={cn(
            "absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white",
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
      <span className="sr-only">
        {count != null
          ? `${count} ${m.todoCenter.total.toLowerCase()}`
          : m.todoCenter.title}
      </span>
    </Link>
  );
}
