import {
  BADGE_TONE_CLASSES,
  TICKET_ITEM_STATUS_LABELS,
  TICKET_ITEM_STATUS_TONES,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_TONES,
  TICKET_SOURCE_LABELS,
  TICKET_SOURCE_TONES,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_TONES,
  type BadgeTone,
} from "../constants";
import type {
  ServiceTicketItemStatus,
  ServiceTicketPriority,
  ServiceTicketSourceChannel,
  ServiceTicketStatus,
} from "@cleanhub/api-client";

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
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${BADGE_TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function TicketStatusBadge({
  status,
}: {
  status: ServiceTicketStatus;
}) {
  return (
    <TicketBadge tone={TICKET_STATUS_TONES[status]}>
      {TICKET_STATUS_LABELS[status]}
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
      {TICKET_PRIORITY_LABELS[priority]}
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
      {TICKET_SOURCE_LABELS[source]}
    </TicketBadge>
  );
}

export function TicketItemStatusBadge({
  status,
}: {
  status: ServiceTicketItemStatus;
}) {
  return (
    <TicketBadge tone={TICKET_ITEM_STATUS_TONES[status]}>
      {TICKET_ITEM_STATUS_LABELS[status]}
    </TicketBadge>
  );
}
