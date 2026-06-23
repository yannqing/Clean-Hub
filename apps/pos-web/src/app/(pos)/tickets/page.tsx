import { Suspense } from "react";

import { Icon } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";

import { TicketMetrics } from "@/features/tickets/components/ticket-metrics";
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
import type { ServiceTicketStatus } from "@cleanhub/api-client";

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
) {
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

  return {
    q,
    status: statuses,
    ticketType: type,
    priority,
    assistantId: scope === "mine" ? currentUserId : undefined,
    expectedPickupAfter:
      date === "overdue" ? undefined : expectedPickupAfter,
    expectedPickupBefore:
      date === "overdue" ? now.toISOString() : expectedPickupBefore,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
}

export default async function TicketsPage({ searchParams }: TicketsPageProps) {
  const [user, params] = await Promise.all([
    getCurrentUser(),
    searchParams,
  ]);
  const normalized = params as Record<string, string | string[] | undefined>;

  const query = await buildTicketListQuery(normalized, user?.userId);

  const [list, overview] = await Promise.all([
    getTicketsListQuery(query),
    getTicketOverviewQuery({}),
  ]);

  const tickets = list.data;
  const total = list.total;

  return (
    <section>
      <div className="mb-5 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
        <span>POS</span>
        <Icon className="h-3.5 w-3.5" name="chevron-right" />
        <span className="text-slate-600">工单管理</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            工单管理
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            查询工单、跟进服务进度并维护工单信息。
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Icon className="h-4 w-4 text-slate-400" name="alert" />
          本页面仅支持查询，新增工单请在「客户接待」中创建
        </div>
      </div>

      <TicketMetrics overview={overview} />

      <Suspense fallback={null}>
        <TicketsToolbar
          // "mine" count is only meaningful under the mine scope; under "all"
          // we show the full total. Both now come from the page-agnostic total.
          mineCount={query.assistantId ? total : undefined}
          totalCount={total}
        />
      </Suspense>

      <TicketsTable tickets={tickets} total={total} />
    </section>
  );
}
