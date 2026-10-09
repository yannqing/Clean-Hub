"use client";

import type {
  TenantOrderTimelineResponse,
  TenantUserSummary,
} from "@cleanhub/api-client";
import {
  BadgeDollarSign,
  CheckCircle2,
  CircleDot,
  MessageSquareText,
  PackageCheck,
  RefreshCcw,
  Sparkles,
  TicketCheck,
  Truck,
  XCircle,
} from "lucide-react";

import {
  TenantTimeline,
  type TenantTimelineItem,
  type TenantTimelineVisual,
} from "@/components/tenant-timeline";
import {
  createTenantOrderCommentAction,
  deleteTenantOrderCommentAction,
  updateTenantOrderCommentAction,
  uploadTenantOrderAttachmentAction,
} from "@/features/tenant/orders/actions";
import { getTenantOrderTimelineQuery } from "@/features/tenant/orders/queries";
import { interpolate, useTenantI18n } from "@/i18n";

function readString(item: TenantTimelineItem, key: string) {
  const value = item.data[key];
  return typeof value === "string" ? value : undefined;
}

function getTimelineVisual(item: TenantTimelineItem): TenantTimelineVisual {
  if (item.kind === "comment") {
    return { icon: MessageSquareText, tone: "purple" };
  }
  if (item.source === "delivery") return { icon: Truck, tone: "info" };
  if (item.eventType.includes("failed") || item.eventType.includes("deleted")) {
    return { icon: XCircle, tone: "danger" };
  }
  if (item.eventType.includes("refund")) {
    return { icon: RefreshCcw, tone: "purple" };
  }
  if (item.eventType.includes("payment")) {
    return { icon: BadgeDollarSign, tone: "success" };
  }
  if (item.eventType.includes("discount")) {
    return { icon: Sparkles, tone: "purple" };
  }
  if (item.source === "service_ticket") {
    return { icon: TicketCheck, tone: "info" };
  }
  if (item.eventType.includes("status_changed")) {
    return { icon: PackageCheck, tone: "info" };
  }
  if (item.eventType.endsWith("created")) {
    return { icon: CheckCircle2, tone: "success" };
  }
  return { icon: CircleDot, tone: "neutral" };
}

export function TenantOrderTimeline({
  initialTimeline,
  orderId,
  staffMembers,
}: {
  initialTimeline: TenantOrderTimelineResponse;
  orderId: string;
  staffMembers: TenantUserSummary[];
}) {
  const { m } = useTenantI18n();
  const messages = m.orders.detail.timeline;

  function formatStatus(value: string | undefined): string {
    if (!value) return m.orders.detail.notProvided;
    return (
      messages.statusLabels[value as keyof typeof messages.statusLabels] ??
      value.replaceAll("_", " ")
    );
  }

  function getEventMessage(item: TenantTimelineItem): string {
    const actor = item.actorDisplayName || messages.systemActor;
    const eventMessages = messages.events;
    const variables = {
      actor,
      from: formatStatus(readString(item, "fromStatus")),
      to: formatStatus(readString(item, "toStatus")),
    };
    const eventKeyByType: Record<string, keyof typeof eventMessages> = {
      "pos.order.created": "orderCreated",
      "pos.order.updated": "orderUpdated",
      "pos.order.deleted": "orderDeleted",
      "pos.order.status_changed": "statusChanged",
      "pos.order.item_added": "itemAdded",
      "pos.order.item_updated": "itemUpdated",
      "pos.order.item_deleted": "itemDeleted",
      "pos.order.payment_created": "paymentCreated",
      "pos.order.mobile_payment_recorded": "paymentPending",
      "pos.order.mobile_payment_confirmed": "paymentConfirmed",
      "pos.order.mobile_payment_failed": "paymentFailed",
      "pos.order.payment_corrected": "paymentCorrected",
      "pos.order.payment_refunded": "paymentRefunded",
      "pos.order.discount_applied": "discountApplied",
      "pos.order.discount_removed": "discountRemoved",
      "pos.order.zero_total_confirmed": "zeroTotalConfirmed",
      "pos.service_ticket.created": "ticketCreated",
      "pos.service_ticket.updated": "ticketUpdated",
      "pos.service_ticket.status_changed": "ticketStatusChanged",
      "pos.service_ticket.item_added": "ticketItemAdded",
      "pos.service_ticket.item_updated": "ticketItemUpdated",
      "pos.service_ticket.item_status_changed": "ticketItemStatusChanged",
      "pos.service_ticket.item_removed": "ticketItemRemoved",
      "delivery.task.status_changed": "deliveryStatusChanged",
    };
    return interpolate(
      eventMessages[eventKeyByType[item.eventType] ?? "unknown"],
      variables,
    );
  }

  return (
    <TenantTimeline
      createComment={(input) => createTenantOrderCommentAction(orderId, input)}
      deleteComment={(commentId, version) =>
        deleteTenantOrderCommentAction(orderId, commentId, version)
      }
      getEventMessage={getEventMessage}
      getItemVisual={getTimelineVisual}
      initialTimeline={initialTimeline}
      loadTimeline={(query) => getTenantOrderTimelineQuery(orderId, query)}
      messages={messages}
      staffMembers={staffMembers}
      staffOnlyText={m.orders.detail.staffOnly}
      titleId="order-timeline-title"
      updateComment={(commentId, input) =>
        updateTenantOrderCommentAction(orderId, commentId, input)
      }
      uploadAttachment={uploadTenantOrderAttachmentAction}
    />
  );
}
