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

import { formatOrderDateTime, formatOrderMoney } from "../constants";

const PRIORITY_LABELS: Record<PosOrderTicketReference["priority"], string> = {
  normal: "普通",
  urgent: "加急",
  critical: "特急",
};

const TICKET_STATUS_LABELS: Record<
  PosOrderTicketReference["ticketStatus"],
  string
> = {
  draft: "草稿",
  pending: "待处理",
  in_progress: "处理中",
  ready_to_pick: "待取件",
  picked_up: "已取件",
  cancelled: "已取消",
  exception: "异常",
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
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b px-5 py-4">
        <div className="min-w-0">
          <CardTitle>关联工单</CardTitle>
          <CardDescription className="mt-1 text-xs">
            {ticketReferences.length > 1
              ? `本单合并结算了 ${ticketReferences.length} 张工单，以下为受理时记录的信息。`
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
                    {TICKET_STATUS_LABELS[reference.ticketStatus]}
                  </Badge>
                  {reference.priority === "normal" ? null : (
                    <Badge
                      className="rounded-md text-[11px]"
                      variant="secondary"
                    >
                      {PRIORITY_LABELS[reference.priority]}
                    </Badge>
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
      </CardContent>
    </Card>
  );
}
