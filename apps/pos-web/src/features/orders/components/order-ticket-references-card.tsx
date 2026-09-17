import type { PosOrderTicketReference } from "@cleanhub/api-client";
import {
  Badge,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@cleanhub/ui";
import Link from "next/link";

import { Icon } from "@/components/app-shell";
import { posRoutes } from "@/config";
import { posMessage } from "@/lib/pos-message";

import {
  getTicketPriorityLabel,
  getTicketStatusLabel,
} from "@/lib/ticket-labels";

import { formatOrderDateTime, formatOrderMoney } from "../constants";

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
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b px-5 py-4">
        <div className="min-w-0">
          <CardTitle>关联工单</CardTitle>
          <CardDescription className="mt-1 text-xs">
            {ticketReferences.length > 1
              ? posMessage("pos.inline.mergedTicketsNote", {
                  count: ticketReferences.length,
                })
              : "以下为受理时记录的信息，不随工单后续修改而变化。"}
          </CardDescription>
        </div>
        <CardAction>
          <Icon
            className="h-5 w-5 text-muted-foreground"
            name="clipboard-list"
          />
        </CardAction>
      </CardHeader>

      <CardContent className="divide-y px-0">
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
                  <Badge
                    className="rounded-md text-[11px]"
                    variant={
                      reference.ticketStatus === "picked_up"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {getTicketStatusLabel(reference.ticketStatus)}
                  </Badge>
                  {reference.priority === "normal" ? null : (
                    <Badge
                      className="rounded-md text-[11px]"
                      variant="secondary"
                    >
                      {getTicketPriorityLabel(reference.priority)}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {reference.itemCount} 件
                  {reference.assistantName
                    ? ` · ${posMessage("pos.inline.assistantNamed", {
                        name: reference.assistantName,
                      })}`
                    : ""}
                  {reference.expectedPickupAt
                    ? ` · ${posMessage("pos.inline.expectedPickupAt", {
                        time: formatOrderDateTime(
                          reference.expectedPickupAt,
                          locale,
                        ),
                      })}`
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
      </CardContent>
    </Card>
  );
}
