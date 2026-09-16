import type {
  ServiceTicketItemStatus,
  ServiceTicketItemType,
  ServiceTicketPriority,
  ServiceTicketSourceChannel,
  ServiceTicketStatus,
  ServiceTicketType,
} from "@cleanhub/api-client";
import { createTranslator, type TranslationKey } from "@cleanhub/i18n";

import { getPosRuntimeLocale } from "@/components/i18n/pos-runtime-text";

/**
 * Ticket vocabulary, shared by every feature that shows a ticket.
 *
 * Tickets, customers and orders each render the same statuses and types, and
 * each used to keep its own Chinese-keyed copy. They had already drifted:
 * `critical` read 特急 on an order and 最紧急 on a ticket, and an item in
 * quality check read 已完成 on the customer page but 质检中 on the ticket
 * page -- the same state described two different ways to the same cashier.
 *
 * Lives in `lib` rather than in the tickets feature so the customers and
 * orders features can share it without depending on another feature.
 *
 * Wording comes from the typed `pos.ticket.*` catalogue, keyed by the wire
 * enums, so the API stays the single source of truth for the values and a
 * missing label fails the build.
 *
 * Resolved per call, not frozen at module load: the runtime locale is set
 * during render by `PosRuntimeLocaleBridge` and the localizer above
 * re-renders the tree on a language switch, so a call-time lookup follows the
 * new language while a module-scope constant would keep the one the tab
 * started in.
 */
function label(key: TranslationKey): string {
  return createTranslator({ locale: getPosRuntimeLocale() })(key);
}

export const TICKET_STATUS_VALUES = [
  "draft",
  "pending",
  "in_progress",
  "ready_to_pick",
  "picked_up",
  "cancelled",
  "exception",
] as const satisfies ReadonlyArray<ServiceTicketStatus>;

export const TICKET_PRIORITY_VALUES = [
  "normal",
  "urgent",
  "critical",
] as const satisfies ReadonlyArray<ServiceTicketPriority>;

export const TICKET_TYPE_VALUES = [
  "laundry",
  "car_wash",
] as const satisfies ReadonlyArray<ServiceTicketType>;

export const TICKET_SOURCE_VALUES = [
  "pos",
  "app",
  "phone",
  "whatsapp",
] as const satisfies ReadonlyArray<ServiceTicketSourceChannel>;

export const TICKET_ITEM_TYPE_VALUES = [
  "cloth",
  "car",
  "shoe",
  "carpet",
] as const satisfies ReadonlyArray<ServiceTicketItemType>;

export function getTicketsPageTitle(): string {
  return label("pos.ticket.title");
}

export function getTicketStatusLabel(status: ServiceTicketStatus): string {
  return label(`pos.ticket.status.${status}`);
}

export function getTicketPriorityLabel(
  priority: ServiceTicketPriority,
): string {
  return label(`pos.ticket.priority.${priority}`);
}

export function getTicketTypeLabel(type: ServiceTicketType): string {
  return label(`pos.ticket.type.${type}`);
}

export function getTicketSourceLabel(
  source: ServiceTicketSourceChannel,
): string {
  return label(`pos.ticket.source.${source}`);
}

export function getTicketItemTypeLabel(
  itemType: ServiceTicketItemType,
): string {
  return label(`pos.ticket.itemType.${itemType}`);
}

export function getTicketItemStatusLabel(
  itemStatus: ServiceTicketItemStatus,
): string {
  return label(`pos.ticket.itemStatus.${itemStatus}`);
}

/**
 * Option lists for selects and filter bars.
 *
 * Functions for the same reason the labels are: an array built at module load
 * would freeze the wording in whatever language the tab started in.
 */
export function getTicketStatusOptions(): ReadonlyArray<{
  value: ServiceTicketStatus;
  label: string;
}> {
  return TICKET_STATUS_VALUES.map((value) => ({
    value,
    label: getTicketStatusLabel(value),
  }));
}

export function getTicketPriorityOptions(): ReadonlyArray<{
  value: ServiceTicketPriority;
  label: string;
}> {
  return TICKET_PRIORITY_VALUES.map((value) => ({
    value,
    label: getTicketPriorityLabel(value),
  }));
}

export function getTicketTypeOptions(): ReadonlyArray<{
  value: ServiceTicketType;
  label: string;
}> {
  return TICKET_TYPE_VALUES.map((value) => ({
    value,
    label: getTicketTypeLabel(value),
  }));
}

export function getTicketSourceOptions(): ReadonlyArray<{
  value: ServiceTicketSourceChannel;
  label: string;
}> {
  return TICKET_SOURCE_VALUES.map((value) => ({
    value,
    label: getTicketSourceLabel(value),
  }));
}

export function getTicketItemTypeOptions(): ReadonlyArray<{
  value: ServiceTicketItemType;
  label: string;
}> {
  return TICKET_ITEM_TYPE_VALUES.map((value) => ({
    value,
    label: getTicketItemTypeLabel(value),
  }));
}
