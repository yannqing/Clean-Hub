import { Suspense } from "react";

import { getCurrentUser } from "@/lib/auth";

import { TicketMetrics } from "@/features/tickets/components/ticket-metrics";
import { TicketsPageHeader } from "@/features/tickets/components/tickets-page-header";
import {
  DEFAULT_TICKET_PAGE_SIZE,
  TICKET_FILTER_KEYS,
  parsePageParam,
  parsePageSizeParam,
  parsePriorityParam,
  parseStatusParam,
  parseTypeParam,
} from "@/features/tickets/components/ticket-filter-params";
import { TicketsTable } from "@/features/tickets/components/tickets-table";
import { TicketsToolbar } from "@/features/tickets/components/tickets-toolbar";
import {
  getTicketOverviewQuery,
  getTicketsListQuery,
} from "@/features/tickets/queries";
import type { TicketListDateFilter } from "@/features/tickets/types";
import type {
  ServiceTicketListQuery,
  ServiceTicketStatus,
} from "@cleanhub/api-client";

type TicketsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Build the api-client list query from URL search params. Kept here (not in
 * the toolbar) so the server owns the canonical filter → query mapping.
 *
 * Pagination is page-based in the URL (`page` 1-based + `pageSize`) and
 * converted to `limit`/`offset` for the API.
 */
async function buildTicketListQuery(
  searchParams: Record<string, string | string[] | undefined>,
  currentUserId?: string,
): Promise<{
  current: ServiceTicketListQuery;
  counts: {
    mine: ServiceTicketListQuery;
    all: ServiceTicketListQuery;
  };
}> {
  const get = (key: string): string | undefined => {
    const raw = searchParams[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };

  const scope = get(TICKET_FILTER_KEYS.scope) === "all" ? "all" : "mine";
  const status = parseStatusParam(get(TICKET_FILTER_KEYS.status));
  const type = parseTypeParam(get(TICKET_FILTER_KEYS.type));
  const priority = parsePriorityParam(get(TICKET_FILTER_KEYS.priority));
  const q = get(TICKET_FILTER_KEYS.q)?.trim() || undefined;
  const date = (get(TICKET_FILTER_KEYS.date) as TicketListDateFilter) ?? "all";

  const pageSize = parsePageSizeParam(
    get(TICKET_FILTER_KEYS.pageSize),
    DEFAULT_TICKET_PAGE_SIZE,
  );
  const page = parsePageParam(get(TICKET_FILTER_KEYS.page), 1);

  const now = new Date();
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const expectedPickupAfter =
    date === "last_7d"
      ? new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString()
      : date === "pickup_today"
        ? startOfToday.toISOString()
        : undefined;
  const expectedPickupBefore =
    date === "pickup_today" ? endOfToday.toISOString() : undefined;

  const statuses: ServiceTicketStatus[] | undefined = date === "overdue"
    ? ["pending", "in_progress", "ready_to_pick"]
    : status
      ? [status]
      : undefined;

  const sharedFilters: Omit<
    ServiceTicketListQuery,
    "assistantId" | "limit" | "offset"
  > = {
    q,
    status: statuses,
    ticketType: type,
    priority,
    expectedPickupAfter:
      date === "overdue" ? undefined : expectedPickupAfter,
    expectedPickupBefore:
      date === "overdue" ? now.toISOString() : expectedPickupBefore,
  };

  return {
    current: {
      ...sharedFilters,
      assistantId: scope === "mine" ? currentUserId : undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    },
    counts: {
      mine: {
        ...sharedFilters,
        assistantId: currentUserId,
        limit: 1,
        offset: 0,
      },
      all: {
        ...sharedFilters,
        limit: 1,
        offset: 0,
      },
    },
  };
}

export default async function TicketsPage({ searchParams }: TicketsPageProps) {
  const [user, params] = await Promise.all([
    getCurrentUser(),
    searchParams,
  ]);
  const normalized = params as Record<string, string | string[] | undefined>;

  const query = await buildTicketListQuery(normalized, user?.userId);

  const [list, mineCountResult, allCountResult, overview] = await Promise.all([
    getTicketsListQuery(query.current),
    getTicketsListQuery(query.counts.mine),
    getTicketsListQuery(query.counts.all),
    getTicketOverviewQuery({}),
  ]);

  const tickets = list.data;
  const total = list.total;

  return (
    <section>
      <TicketsPageHeader />

      <TicketMetrics overview={overview} />

      <Suspense fallback={null}>
        <TicketsToolbar
          allCount={allCountResult.total}
          currentCount={total}
          mineCount={mineCountResult.total}
        />
      </Suspense>

      <TicketsTable tickets={tickets} total={total} />
    </section>
  );
}
