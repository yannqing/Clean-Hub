import type { PosOrderTicketReference } from "@cleanhub/api-client";
import Link from "next/link";

import { Icon } from "@/components/app-shell";
import { posRoutes } from "@/config";

import { formatOrderDateTime, formatOrderMoney } from "../constants";

const PRIORITY_LABELS: Record<PosOrderTicketReference["priority"], string> = {
  normal: "普通",
  urgent: "加急",
  critical: "特急",
};

/**
 * Fulfilment context an order settles. One order can cover several tickets, so
 * this lists them all — a customer collecting one batch while dropping off
 * another settles both here.
 *
 * The values are the ones captured at checkout, not the ticket as it stands
 * now, so the order keeps reading the way it did when the money changed hands.
 */
export function OrderTicketReferencesCard({
  ticketReferences,
  currency,
  locale,
}: {
  ticketReferences: PosOrderTicketReference[];
  currency: string;
  locale: string;
}) {
  if (ticketReferences.length === 0) {
    return null;
  }

  return (
    <section className="overflow-hidden border-y bg-background">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground">关联工单</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {ticketReferences.length > 1
              ? `本单合并结算了 ${ticketReferences.length} 张工单，以下为受理时记录的信息。`
              : "以下为受理时记录的信息，不随工单后续修改而变化。"}
          </p>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" name="clipboard-list" />
      </div>

      <div className="divide-y">
        {ticketReferences.map((reference) => (
          <div className="px-5 py-4" key={reference.ticketId}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    className="text-sm font-semibold text-foreground hover:underline"
                    href={posRoutes.ticketDetail(reference.ticketId)}
                  >
                    {reference.ticketNo ?? "工单详情"}
                  </Link>
                  {reference.priority === "normal" ? null : (
                    <span className="rounded-md bg-foreground px-2 py-0.5 text-[11px] font-semibold text-background">
                      {PRIORITY_LABELS[reference.priority]}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {reference.itemCount} 件
                  {reference.assistantName
                    ? ` · 接待 ${reference.assistantName}`
                    : ""}
                  {reference.expectedPickupAt
                    ? ` · 预计取件 ${formatOrderDateTime(reference.expectedPickupAt, locale)}`
                    : ""}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-foreground">
                {formatOrderMoney(reference.itemAmount, currency)}
              </span>
            </div>

            {reference.remark ? (
              <p className="mt-3 rounded-md bg-muted/60 px-3 py-2 text-xs leading-5 text-foreground">
                <span className="font-semibold">工单备注：</span>
                {reference.remark}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
