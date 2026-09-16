import {
  TICKET_ITEM_STATUS_TONES,
  TICKET_PRIORITY_TONES,
  TICKET_SOURCE_TONES,
  TICKET_STATUS_TONES,
  getTicketItemStatusLabel,
  getTicketPriorityLabel,
  getTicketSourceLabel,
  getTicketStatusLabel,
  type BadgeTone,
} from "../constants";
import type {
  ServiceTicketItemStatus,
  ServiceTicketPriority,
  ServiceTicketSourceChannel,
  ServiceTicketStatus,
} from "@cleanhub/api-client";

const DETAIL_BADGE_TONE_CLASSES: Record<BadgeTone, string> = {
  slate: "bg-muted text-muted-foreground",
  blue: "bg-accent text-accent-foreground",
  violet: "bg-accent text-accent-foreground",
  emerald:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/35 dark:text-amber-300",
  red: "bg-destructive/10 text-destructive",
};

/** Generic pill backed by a BadgeTone token. */
export function TicketBadge({
  tone,
  children,
  className = "",
}: {
  tone: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold ${DETAIL_BADGE_TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function TicketStatusBadge({ status }: { status: ServiceTicketStatus }) {
  return (
    <TicketBadge tone={TICKET_STATUS_TONES[status]}>
      {getTicketStatusLabel(status)}
    </TicketBadge>
  );
}

export function TicketPriorityBadge({
  priority,
}: {
  priority: ServiceTicketPriority;
}) {
  return (
    <TicketBadge tone={TICKET_PRIORITY_TONES[priority]}>
      {getTicketPriorityLabel(priority)}
    </TicketBadge>
  );
}

export function TicketSourceBadge({
  source,
}: {
  source: ServiceTicketSourceChannel;
}) {
  return (
    <TicketBadge tone={TICKET_SOURCE_TONES[source]}>
      {getTicketSourceLabel(source)}
    </TicketBadge>
  );
}

export function TicketItemStatusBadge({
  status,
}: {
  status: ServiceTicketItemStatus;
}) {
  return (
    <TicketBadge tone={TICKET_ITEM_STATUS_TONES[status] ?? "slate"}>
      {getTicketItemStatusLabel(status)}
    </TicketBadge>
  );
}
