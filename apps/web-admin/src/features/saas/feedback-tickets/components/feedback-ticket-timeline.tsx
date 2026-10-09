"use client";

import type { FeedbackTicketDetail } from "@cleanhub/api-client";
import { cn } from "@cleanhub/ui";
import { AlertCircle, CheckCircle2, Circle } from "lucide-react";

import { useSaasI18n } from "@/i18n";

import type { FeedbackTicketStatus } from "../types";

type TimelineEntry = {
  status: FeedbackTicketStatus | string;
  at: string;
};

/**
 * Best-effort, purely front-end status timeline.
 *
 * `FeedbackTicketDetail.metadata` is an opaque `Record<string, unknown>`; when
 * the backend (or a future API change) writes a `statusHistory` array there, we
 * render it. Until then we fall back to the two data points every ticket has:
 * creation and last update. This keeps the timeline visible today without
 * assuming a schema that does not yet exist, and "lights up" automatically once
 * structured history is available.
 */
function readTimeline(detail: FeedbackTicketDetail): TimelineEntry[] {
  const history = detail.metadata?.statusHistory;

  if (Array.isArray(history)) {
    const entries: TimelineEntry[] = [];

    for (const raw of history) {
      if (raw && typeof raw === "object") {
        const status = (raw as { status?: unknown }).status;
        const at = (raw as { at?: unknown }).at;

        if (
          typeof status === "string" &&
          typeof at === "string"
        ) {
          entries.push({ status, at });
        }
      }
    }

    if (entries.length > 0) {
      return entries;
    }
  }

  return [
    { status: "open", at: detail.createdAt },
    { status: detail.status, at: detail.updatedAt },
  ];
}

function statusIcon(status: string) {
  if (status === "closed" || status === "resolved") {
    return CheckCircle2;
  }

  if (status === "in_progress") {
    return AlertCircle;
  }

  return Circle;
}

type FeedbackTicketTimelineProps = {
  detail: FeedbackTicketDetail;
};

export function FeedbackTicketTimeline({ detail }: FeedbackTicketTimelineProps) {
  const { m, formatDateTime } = useSaasI18n();
  const entries = readTimeline(detail);

  function labelFor(status: string): string {
    switch (status) {
      case "open":
        return m.common.statusLabels.open;
      case "in_progress":
        return m.common.statusLabels.inProgress;
      case "resolved":
        return m.common.statusLabels.resolved;
      case "closed":
        return m.common.statusLabels.closed;
      default:
        return status;
    }
  }

  return (
    <section aria-label={m.feedbackTickets.timeline.title} className="grid gap-3">
      <h3 className="text-sm font-semibold">
        {m.feedbackTickets.timeline.title}
      </h3>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {m.feedbackTickets.timeline.empty}
        </p>
      ) : (
        <ol className="grid gap-3">
          {entries.map((entry, index) => {
            const Icon = statusIcon(entry.status);
            const isFirst = index === 0;
            const isLast = index === entries.length - 1;

            return (
              <li className="flex gap-3" key={`${entry.at}-${index}`}>
                <div className="flex flex-col items-center">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon aria-hidden className="size-3.5" />
                  </span>
                  {!isLast ? (
                    <span
                      aria-hidden
                      className="mt-1 w-px flex-1 bg-border"
                    />
                  ) : null}
                </div>

                <div className={cn("pb-1", isFirst && "pt-0.5")}>
                  <p className="text-sm font-medium">{labelFor(entry.status)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(entry.at) || m.common.invalidDate}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
