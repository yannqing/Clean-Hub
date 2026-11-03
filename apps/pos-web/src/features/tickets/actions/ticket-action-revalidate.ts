import "server-only";

import { revalidatePath } from "next/cache";

/**
 * Server-only revalidation helper. Isolated here so the rest of the action
 * helpers can be safely imported by client components (and by `"use server"`
 * actions that client components reference) without dragging `next/cache` into
 * the client bundle.
 */
export const TICKETS_LIST_PATH = "/tickets";

export function ticketDetailPath(ticketId: string): string {
  return `/tickets/${ticketId}`;
}

/** Revalidate both the list and the detail page after a mutation. */
export function revalidateTicketPages(ticketId?: string): void {
  revalidatePath(TICKETS_LIST_PATH);
  if (ticketId) {
    revalidatePath(ticketDetailPath(ticketId));
  }
}
