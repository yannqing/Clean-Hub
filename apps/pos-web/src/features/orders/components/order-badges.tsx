"use client";

import { cn } from "@cleanhub/ui";
import { useTranslation } from "@cleanhub/i18n/react";
import type {
  PosOrderPaymentStatus,
  PosOrderStatus,
} from "@cleanhub/api-client";
import type { ReactNode } from "react";

import { translatePosText } from "@/components/i18n/pos-runtime-text";

import {
  BADGE_TONE_CLASSES,
  ORDER_PAYMENT_STATUS_LABELS,
  ORDER_PAYMENT_STATUS_TONES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  type BadgeTone,
} from "../constants";

export function OrderBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: BadgeTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold",
        BADGE_TONE_CLASSES[tone],
      )}
    >
      {children}
    </span>
  );
}

export function OrderStatusBadge({ status }: { status: PosOrderStatus }) {
  const { locale } = useTranslation();

  return (
    <OrderBadge tone={ORDER_STATUS_TONES[status]}>
      {translatePosText(ORDER_STATUS_LABELS[status], locale)}
    </OrderBadge>
  );
}

export function OrderPaymentStatusBadge({
  status,
}: {
  status: PosOrderPaymentStatus;
}) {
  const { locale } = useTranslation();

  return (
    <OrderBadge tone={ORDER_PAYMENT_STATUS_TONES[status]}>
      {translatePosText(ORDER_PAYMENT_STATUS_LABELS[status], locale)}
    </OrderBadge>
  );
}
