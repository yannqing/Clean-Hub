"use client";

import type {
  TenantCustomerTimelineResponse,
  TenantUserSummary,
} from "@cleanhub/api-client";
import {
  CircleDot,
  Link2,
  MessageSquareText,
  UserRoundCog,
  UserRoundPlus,
  UserRoundX,
} from "lucide-react";

import {
  TenantTimeline,
  type TenantTimelineItem,
  type TenantTimelineVisual,
} from "@/components/tenant-timeline";
import { interpolate, useTenantI18n } from "@/i18n";

import {
  createTenantCustomerCommentAction,
  deleteTenantCustomerCommentAction,
  updateTenantCustomerCommentAction,
  uploadTenantCustomerAttachmentAction,
} from "../actions";
import { getTenantCustomerTimelineQuery } from "../queries";

function readString(item: TenantTimelineItem, key: string) {
  const value = item.data[key];
  return typeof value === "string" ? value : undefined;
}

function getTimelineVisual(item: TenantTimelineItem): TenantTimelineVisual {
  if (item.kind === "comment") {
    return { icon: MessageSquareText, tone: "purple" };
  }
  if (item.eventType.includes("deleted")) {
    return { icon: UserRoundX, tone: "danger" };
  }
  if (item.eventType.includes("status_changed")) {
    return { icon: UserRoundCog, tone: "warning" };
  }
  if (item.eventType.endsWith("created")) {
    return {
      icon: item.source === "customer_account" ? Link2 : UserRoundPlus,
      tone: "success",
    };
  }
  if (item.eventType.endsWith("updated")) {
    return { icon: UserRoundCog, tone: "info" };
  }
  return { icon: CircleDot, tone: "neutral" };
}

export function TenantCustomerTimeline({
  customerId,
  initialTimeline,
  staffMembers,
}: {
  customerId: string;
  initialTimeline: TenantCustomerTimelineResponse;
  staffMembers: TenantUserSummary[];
}) {
  const { m } = useTenantI18n();
  const customerTimeline = m.customers.detail.timeline;
  const messages = {
    ...m.orders.detail.timeline,
    title: customerTimeline.title,
  };

  function formatStatus(value: string | undefined) {
    if (!value) return m.customers.notProvided;
    return (
      m.customers.statusLabels[
        value as keyof typeof m.customers.statusLabels
      ] ?? value.replaceAll("_", " ")
    );
  }

  function getEventMessage(item: TenantTimelineItem) {
    const actor = item.actorDisplayName || messages.systemActor;
    const variables = {
      actor,
      from: formatStatus(readString(item, "fromStatus")),
      to: formatStatus(readString(item, "toStatus")),
    };
    const eventKeyByType: Record<string, keyof typeof customerTimeline.events> =
      {
        "pos_customer.profile_created": "profileCreated",
        "pos_customer.profile_updated": "profileUpdated",
        "pos_customer.profile_status_changed": "profileStatusChanged",
        "pos_customer.profile_deleted": "profileDeleted",
        "pos_customer.account_created": "accountCreated",
        "pos_customer.account_updated": "accountUpdated",
        "pos_customer.account_status_changed": "accountStatusChanged",
        "pos_customer.account_deleted": "accountDeleted",
      };
    return interpolate(
      customerTimeline.events[eventKeyByType[item.eventType] ?? "unknown"],
      variables,
    );
  }

  return (
    <TenantTimeline
      createComment={(input) =>
        createTenantCustomerCommentAction(customerId, input)
      }
      deleteComment={(commentId, version) =>
        deleteTenantCustomerCommentAction(customerId, commentId, version)
      }
      getEventMessage={getEventMessage}
      getItemVisual={getTimelineVisual}
      initialTimeline={initialTimeline}
      loadTimeline={(query) =>
        getTenantCustomerTimelineQuery(customerId, query)
      }
      messages={messages}
      staffMembers={staffMembers}
      staffOnlyText={m.orders.detail.staffOnly}
      titleId="customer-timeline-title"
      updateComment={(commentId, input) =>
        updateTenantCustomerCommentAction(customerId, commentId, input)
      }
      uploadAttachment={(input) =>
        uploadTenantCustomerAttachmentAction(customerId, input)
      }
    />
  );
}
