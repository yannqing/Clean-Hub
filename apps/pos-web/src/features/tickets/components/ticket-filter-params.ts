import type {
  ServiceTicketPriority,
  ServiceTicketStatus,
  ServiceTicketType,
} from "@cleanhub/api-client";

import {
  TICKET_PRIORITY_VALUES,
  TICKET_STATUS_VALUES,
  TICKET_TYPE_VALUES,
} from "../constants";

/**
 * URL search-param keys shared by the tickets list page (server) and the
 * toolbar (client). Kept in a plain module — no `"use client"` — so both the
 * server component and the client toolbar can import it without crossing the
 * server/client boundary.
 */
export const TICKET_FILTER_KEYS = {
  scope: "scope",
  q: "q",
  status: "status",
  type: "type",
  priority: "priority",
  date: "date",
  columns: "columns",
  page: "page",
  pageSize: "pageSize",
} as const;

/** Default page size for the tickets list. */
export const DEFAULT_TICKET_PAGE_SIZE = 10;

/** Allowed page-size options surfaced in the list-page selector. */
export const TICKET_PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50];

export const TICKET_MAX_PAGE_SIZE = 100;

export const TICKET_COLUMN_KEYS = [
  "ticket",
  "account",
  "customer",
  "type",
  "status",
  "priority",
  "pickup",
] as const;

export type TicketColumnKey = (typeof TICKET_COLUMN_KEYS)[number];

/**
 * Parse a raw query-string value into a valid ticket status enum, or undefined.
 * Used by the server list page when composing the api-client query.
 */
export function parseStatusParam(
  value: string | null | undefined,
): ServiceTicketStatus | undefined {
  return (
    (value &&
      ((TICKET_STATUS_VALUES as readonly string[]).includes(value)
        ? (value as ServiceTicketStatus)
        : undefined)) ||
    undefined
  );
}

export function parseTypeParam(
  value: string | null | undefined,
): ServiceTicketType | undefined {
  return (
    (value &&
      ((TICKET_TYPE_VALUES as readonly string[]).includes(value)
        ? (value as ServiceTicketType)
        : undefined)) ||
    undefined
  );
}

export function parsePriorityParam(
  value: string | null | undefined,
): ServiceTicketPriority | undefined {
  return (
    (value &&
      ((TICKET_PRIORITY_VALUES as readonly string[]).includes(value)
        ? (value as ServiceTicketPriority)
        : undefined)) ||
    undefined
  );
}

/**
 * Parse a 1-based page number from a query-string value. Falls back to 1 for
 * missing/non-numeric/non-positive input. Used by both the server page (to
 * compute offset) and the client pagination control (to highlight the page).
 */
export function parsePageParam(
  value: string | null | undefined,
  fallback = 1,
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

/**
 * Parse the page size, clamped to the allowed options and the backend max.
 * Falls back to DEFAULT_TICKET_PAGE_SIZE for missing/invalid input.
 */
export function parsePageSizeParam(
  value: string | null | undefined,
  fallback = DEFAULT_TICKET_PAGE_SIZE,
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, TICKET_MAX_PAGE_SIZE);
}
