import type {
  ServiceTicketPriority,
  ServiceTicketSourceChannel,
  ServiceTicketType,
} from "@cleanhub/api-client";

import type { TicketBasicFormValues } from "../types";

export type TicketFormField = keyof TicketBasicFormValues;
export type TicketFormFieldErrors = Partial<Record<TicketFormField, string>>;

/**
 * Validate the ticket basic-info edit form. Mirrors the server-side rules in
 * `service-tickets.validation.ts` for UpdateServiceTicketRequest so illegal
 * values never reach the API. Returns null when there are no errors.
 */
export function validateTicketForm(
  values: TicketBasicFormValues,
): TicketFormFieldErrors | null {
  const errors: TicketFormFieldErrors = {};

  if (!values.ticketType) {
    errors.ticketType = "请选择工单类型";
  }
  if (!values.priority) {
    errors.priority = "请选择优先级";
  }
  if (!values.sourceChannel) {
    errors.sourceChannel = "请选择来源渠道";
  }
  if (values.remark.length > 1000) {
    errors.remark = "备注不能超过 1000 字";
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

/** Pick a valid ticket type from a raw string, falling back to a default. */
export function coerceTicketType(
  raw: unknown,
  fallback: ServiceTicketType = "laundry",
): ServiceTicketType {
  return raw === "laundry" ||
    raw === "car_wash" ||
    raw === "retail" ||
    raw === "delivery"
    ? raw
    : fallback;
}

export function coerceTicketPriority(
  raw: unknown,
  fallback: ServiceTicketPriority = "normal",
): ServiceTicketPriority {
  return raw === "normal" || raw === "urgent" || raw === "critical"
    ? raw
    : fallback;
}

export function coerceTicketSource(
  raw: unknown,
  fallback: ServiceTicketSourceChannel = "pos",
): ServiceTicketSourceChannel {
  return raw === "pos" || raw === "app" || raw === "phone" || raw === "whatsapp"
    ? raw
    : fallback;
}
