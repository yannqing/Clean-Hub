"use client";

import { Badge, cn } from "@cleanhub/ui";
import { useMemo, useState } from "react";

import { useSaasI18n } from "@/i18n";

import { computeTicketSla, formatSlaRemaining } from "../sla";
import type { FeedbackTicketListItem } from "../types";

type FeedbackTicketSlaBadgeProps = {
  ticket: Pick<
    FeedbackTicketListItem,
    "createdAt" | "priority" | "status"
  >;
};

const SLA_STATUS_CLASS = {
  met: "border-transparent bg-muted text-muted-foreground",
  on_track: "border-transparent bg-muted text-muted-foreground",
  due_soon:
    "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  overdue: "border-destructive/40 bg-destructive/10 text-destructive",
} as const;

/**
 * Renders the SLA status of a single ticket as a colored badge plus a compact
 * remaining/elapsed label. The underlying deadline is derived purely on the
 * client from `createdAt` + `priority` (see `sla.ts`); when the API later
 * exposes a server-side `sla_deadline` the helper can be swapped out without
 * touching this component.
 *
 * Color semantics:
 * - met / on_track → neutral
 * - due_soon       → amber
 * - overdue        → destructive
 *
 * `now` is captured once per mount (state initializer, not an effect) to keep
 * the component pure during render; SLA badges are point-in-time indicators
 * and don't need to tick live.
 */
export function FeedbackTicketSlaBadge({
  ticket,
}: FeedbackTicketSlaBadgeProps) {
  const { m } = useSaasI18n();
  // State initializer runs once on mount; reading the clock here keeps render
  // itself pure (no `Date.now()` call in the render body).
  const [now] = useState(() => Date.now());

  const { sla, label } = useMemo(() => {
    const computed = computeTicketSla(ticket, now);

    return {
      sla: computed,
      label: formatSlaRemaining(computed, now, {
        met: m.feedbackTickets.sla.met,
        onTrack: m.feedbackTickets.sla.onTrack,
        left: m.feedbackTickets.sla.left,
        overdue: m.feedbackTickets.sla.overdue,
        lessThanHourLeft: m.feedbackTickets.sla.lessThanHourLeft,
      }),
    };
  }, [ticket, now, m.feedbackTickets.sla]);

  const ariaLabel =
    sla.status === "overdue"
      ? `${m.feedbackTickets.sla.overDueAria} — ${label}`
      : sla.status === "due_soon"
        ? `${m.feedbackTickets.sla.dueSoonAria} — ${label}`
        : `${m.feedbackTickets.sla.label}: ${label}`;

  return (
    <Badge
      aria-label={ariaLabel}
      className={cn("font-medium", SLA_STATUS_CLASS[sla.status])}
      variant="outline"
    >
      {label}
    </Badge>
  );
}
