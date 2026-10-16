"use client";

import { Badge, cn } from "@cleanhub/ui";
import type {
  PosOrderPaymentStatus,
  PosOrderStatus,
} from "@cleanhub/api-client";
import type { ReactNode } from "react";

import {
  getOrderPaymentStatusLabel,
  getOrderStatusLabel,
} from "@/lib/order-labels";

import {
  ORDER_PAYMENT_STATUS_TONES,
  ORDER_STATUS_TONES,
  type BadgeTone,
} from "../constants";

const DETAIL_BADGE_TONE_CLASSES: Record<BadgeTone, string> = {
  slate: "bg-muted text-muted-foreground",
  blue: "bg-accent text-accent-foreground",
  violet: "bg-accent text-accent-foreground",
  emerald:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/35 dark:text-amber-300",
  red: "bg-destructive/10 text-destructive",
};

export function OrderBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: BadgeTone;
}) {
  return (
    <Badge
      className={cn(
        "h-6 border-0 px-2.5 font-semibold shadow-none",
        DETAIL_BADGE_TONE_CLASSES[tone],
      )}
      variant="secondary"
    >
      {children}
    </Badge>
  );
}

export function OrderStatusBadge({ status }: { status: PosOrderStatus }) {
  return (
    <OrderBadge tone={ORDER_STATUS_TONES[status]}>
      {getOrderStatusLabel(status)}
    </OrderBadge>
  );
}

export function OrderPaymentStatusBadge({
  status,
}: {
  status: PosOrderPaymentStatus;
}) {
  return (
    <OrderBadge tone={ORDER_PAYMENT_STATUS_TONES[status]}>
      {getOrderPaymentStatusLabel(status)}
    </OrderBadge>
  );
}
