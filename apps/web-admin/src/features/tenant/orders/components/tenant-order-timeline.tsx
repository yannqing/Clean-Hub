"use client";

import type {
  TenantOrderTimelineItem,
  TenantOrderTimelineResponse,
  TenantUserSummary,
} from "@cleanhub/api-client";
import { createId } from "@cleanhub/id";
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Icon,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Textarea,
  cn,
  toast,
} from "@cleanhub/ui";
import {
  AtSign,
  BadgeDollarSign,
  Check,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  ImageIcon,
  LoaderCircle,
  MessageSquareText,
  PackageCheck,
  Paperclip,
  Pencil,
  RefreshCcw,
  Search,
  Sparkles,
  TicketCheck,
  Trash2,
  Truck,
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  createTenantOrderCommentAction,
  deleteTenantOrderCommentAction,
  updateTenantOrderCommentAction,
  uploadTenantOrderAttachmentAction,
} from "@/features/tenant/orders/actions";
import { getTenantOrderTimelineQuery } from "@/features/tenant/orders/queries";
import { interpolate, useTenantI18n } from "@/i18n";

import type { OrderStatusTone } from "./order-status-pill";

type TimelineIcon = typeof CircleDot;
type TimelineMessages = ReturnType<typeof useTenantI18n>["m"]["orders"]["detail"]["timeline"];
type PendingAttachment = {
  id: string;
  file: File;
  objectKey?: string;
  expiresAt?: string;
};

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getTimelineVisual(item: TenantOrderTimelineItem): {
  icon: TimelineIcon;
  tone: OrderStatusTone;
} {
  if (item.kind === "comment") return { icon: MessageSquareText, tone: "purple" };
  if (item.source === "delivery") return { icon: Truck, tone: "info" };
  if (item.eventType.includes("failed") || item.eventType.includes("deleted")) {
    return { icon: XCircle, tone: "danger" };
  }
  if (item.eventType.includes("refund")) return { icon: RefreshCcw, tone: "purple" };
  if (item.eventType.includes("payment")) return { icon: BadgeDollarSign, tone: "success" };
  if (item.eventType.includes("discount")) return { icon: Sparkles, tone: "purple" };
  if (item.source === "service_ticket") return { icon: TicketCheck, tone: "info" };
  if (item.eventType.includes("status_changed")) return { icon: PackageCheck, tone: "info" };
  if (item.eventType.endsWith("created")) return { icon: CheckCircle2, tone: "success" };
  return { icon: CircleDot, tone: "neutral" };
}

const nodeToneClasses: Record<OrderStatusTone, string> = {
  neutral: "border-slate-200 bg-slate-100 text-slate-600",
  info: "border-sky-200 bg-sky-100 text-sky-700",
  warning: "border-amber-200 bg-amber-100 text-amber-800",
  success: "border-emerald-200 bg-emerald-100 text-emerald-700",
  danger: "border-red-200 bg-red-100 text-red-700",
  purple: "border-violet-200 bg-violet-100 text-violet-700",
};

function readString(item: TenantOrderTimelineItem, key: string) {
  const value = item.data[key];
  return typeof value === "string" ? value : undefined;
}

function MentionPicker({
  disabled,
  members,
  messages,
  onChange,
  value,
}: {
  disabled?: boolean;
  members: TenantUserSummary[];
  messages: TimelineMessages;
  onChange: (userIds: string[]) => void;
  value: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedMembers = value.flatMap((userId) => {
    const member = members.find((candidate) => candidate.id === userId);
    return member ? [member] : [];
  });
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredMembers = members.filter((member) =>
    [member.displayName, member.email, member.phone]
      .filter(Boolean)
      .some((candidate) =>
        candidate!.toLocaleLowerCase().includes(normalizedQuery),
      ),
  );

  function toggle(userId: string) {
    onChange(
      value.includes(userId)
        ? value.filter((candidate) => candidate !== userId)
        : [...value, userId],
    );
  }

  return (
    <div className="space-y-2">
      {selectedMembers.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedMembers.map((member) => (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-1 text-xs font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200"
              key={member.id}
            >
              @{member.displayName}
              <button
                aria-label={`${messages.removeMention} ${member.displayName}`}
                className="rounded-full p-0.5 hover:bg-violet-200 dark:hover:bg-violet-900"
                disabled={disabled}
                onClick={() => toggle(member.id)}
                type="button"
              >
                <Icon aria-hidden icon={X} size={11} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button disabled={disabled} size="sm" type="button" variant="ghost">
            <Icon aria-hidden icon={AtSign} size={14} />
            {messages.mentionAction}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-2">
          <div className="relative">
            <Icon
              aria-hidden
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              icon={Search}
              size={14}
            />
            <Input
              autoFocus
              className="h-9 pl-8"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={messages.mentionSearchPlaceholder}
              value={query}
            />
          </div>
          <div className="mt-2 max-h-56 overflow-y-auto">
            {filteredMembers.length === 0 ? (
              <p className="px-2 py-5 text-center text-xs text-muted-foreground">
                {messages.noMentionResults}
              </p>
            ) : (
              filteredMembers.map((member) => {
                const selected = value.includes(member.id);
                return (
                  <button
                    className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                    key={member.id}
                    onClick={() => toggle(member.id)}
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {member.displayName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {member.email || member.phone || member.role}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded border",
                        selected
                          ? "border-violet-600 bg-violet-600 text-white"
                          : "border-input",
                      )}
                    >
                      {selected ? <Icon aria-hidden icon={Check} size={13} /> : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
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
  const { formatDate, formatDateTime, locale, m } = useTenantI18n();
  const messages = m.orders.detail.timeline;
  const [items, setItems] = useState(initialTimeline.data);
  const [nextCursor, setNextCursor] = useState(initialTimeline.nextCursor);
  const [comment, setComment] = useState("");
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const [posting, setPosting] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [editingMentionIds, setEditingMentionIds] = useState<string[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TenantOrderTimelineItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  function formatStatus(value: string | undefined): string {
    if (!value) return m.orders.detail.notProvided;
    return (
      messages.statusLabels[value as keyof typeof messages.statusLabels] ??
      value.replaceAll("_", " ")
    );
  }

  function getEventMessage(item: TenantOrderTimelineItem): string {
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
    const eventKey = eventKeyByType[item.eventType] ?? "unknown";
    return interpolate(eventMessages[eventKey], variables);
  }

  const groups = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const now = new Date();
    const todayKey = formatter.format(now);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayKey = formatter.format(yesterday);
    const grouped = new Map<string, TenantOrderTimelineItem[]>();
    for (const item of items) {
      const dateKey = formatter.format(new Date(item.occurredAt));
      const label =
        dateKey === todayKey
          ? messages.today
          : dateKey === yesterdayKey
            ? messages.yesterday
            : formatDate(item.occurredAt);
      grouped.set(label, [...(grouped.get(label) ?? []), item]);
    }
    return [...grouped.entries()];
  }, [formatDate, items, locale, messages.today, messages.yesterday]);

  function addAttachments(files: File[]) {
    let invalidType = false;
    let tooLarge = false;
    const validFiles = files.filter((file) => {
      if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
        invalidType = true;
        return false;
      }
      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        tooLarge = true;
        return false;
      }
      return true;
    });
    if (invalidType) toast.error(messages.attachmentTypeInvalid);
    if (tooLarge) toast.error(messages.attachmentTooLarge);

    const existing = new Set(
      pendingAttachments.map(
        (attachment) =>
          `${attachment.file.name}:${attachment.file.size}:${attachment.file.lastModified}`,
      ),
    );
    const unique = validFiles.filter(
      (file) =>
        !existing.has(`${file.name}:${file.size}:${file.lastModified}`),
    );
    const available = MAX_ATTACHMENTS - pendingAttachments.length;
    if (unique.length > available) toast.error(messages.attachmentLimit);
    setPendingAttachments((current) => [
      ...current,
      ...unique.slice(0, available).map((file) => ({
        id: crypto.randomUUID(),
        file,
      })),
    ]);
  }

  async function uploadAttachments() {
    const uploaded: Array<{ objectKey: string; fileName: string }> = [];

    for (const attachment of pendingAttachments) {
      const expiresAt = attachment.expiresAt
        ? new Date(attachment.expiresAt).getTime()
        : 0;
      if (
        attachment.objectKey &&
        Number.isFinite(expiresAt) &&
        expiresAt - Date.now() > 60_000
      ) {
        uploaded.push({
          objectKey: attachment.objectKey,
          fileName: attachment.file.name,
        });
        continue;
      }

      const result = await uploadTenantOrderAttachmentAction({
        contentType: attachment.file.type,
        sizeBytes: attachment.file.size,
      });
      if (!result.ok) {
        toast.error(
          result.reason === "type"
            ? messages.attachmentTypeInvalid
            : result.reason === "size"
              ? messages.attachmentTooLarge
              : messages.attachmentUploadFailed,
        );
        return null;
      }

      let response: Response;
      try {
        response = await fetch(result.ticket.uploadUrl, {
          method: "PUT",
          headers: result.ticket.headers,
          body: attachment.file,
        });
      } catch {
        toast.error(messages.attachmentUploadFailed);
        return null;
      }
      if (!response.ok) {
        toast.error(messages.attachmentUploadFailed);
        return null;
      }

      uploaded.push({
        objectKey: result.ticket.objectKey,
        fileName: attachment.file.name,
      });
      setPendingAttachments((current) =>
        current.map((candidate) =>
          candidate.id === attachment.id
            ? {
                ...candidate,
                objectKey: result.ticket.objectKey,
                expiresAt: result.ticket.expiresAt,
              }
            : candidate,
        ),
      );
    }

    return uploaded;
  }

  async function postComment() {
    const body = comment.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const attachments = await uploadAttachments();
      if (attachments === null) return;
      const result = await createTenantOrderCommentAction(orderId, {
        body,
        idempotencyKey: createId(),
        mentionedUserIds,
        attachments,
      });
      if (!result.ok) {
        toast.error(result.message || messages.postError);
        return;
      }
      setItems((current) => [
        result.data,
        ...current.filter((item) => item.id !== result.data.id),
      ]);
      setComment("");
      setMentionedUserIds([]);
      setPendingAttachments([]);
    } catch {
      toast.error(messages.postError);
    } finally {
      setPosting(false);
    }
  }

  function beginEdit(item: TenantOrderTimelineItem) {
    setEditingId(item.id);
    setEditingBody(item.body ?? "");
    setEditingMentionIds(item.mentions.map((mention) => mention.userId));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingBody("");
    setEditingMentionIds([]);
  }

  async function saveEdit(item: TenantOrderTimelineItem) {
    const body = editingBody.trim();
    if (!body || item.version === null || savingId) return;
    setSavingId(item.id);
    try {
      const result = await updateTenantOrderCommentAction(orderId, item.id, {
        body,
        version: item.version,
        mentionedUserIds: editingMentionIds,
      });
      if (!result.ok) {
        toast.error(result.message || messages.editError);
        return;
      }
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === result.data.id ? result.data : candidate,
        ),
      );
      cancelEdit();
    } catch {
      toast.error(messages.editError);
    } finally {
      setSavingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteTarget.version === null || deleting) return;
    setDeleting(true);
    try {
      const result = await deleteTenantOrderCommentAction(
        orderId,
        deleteTarget.id,
        deleteTarget.version,
      );
      if (!result.ok) {
        toast.error(result.message || messages.deleteError);
        return;
      }
      setItems((current) =>
        current.filter((item) => item.id !== deleteTarget.id),
      );
      setDeleteTarget(null);
    } catch {
      toast.error(messages.deleteError);
    } finally {
      setDeleting(false);
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await getTenantOrderTimelineQuery(orderId, {
        cursor: nextCursor,
        limit: 20,
      });
      setItems((current) => {
        const ids = new Set(current.map((item) => item.id));
        return [...current, ...result.data.filter((item) => !ids.has(item.id))];
      });
      setNextCursor(result.nextCursor);
    } catch {
      toast.error(messages.loadError);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section aria-labelledby="order-timeline-title" className="space-y-3">
      <h2 className="px-1 text-base font-semibold" id="order-timeline-title">
        {messages.title}
      </h2>

      <Card className="gap-0 overflow-hidden rounded-xl py-0 shadow-none">
        <CardContent className="p-0">
          <div className="flex gap-3 p-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white">
              <Icon aria-hidden icon={MessageSquareText} size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <Textarea
                aria-label={messages.commentPlaceholder}
                className="min-h-20 resize-y border-0 bg-transparent px-0 py-1 shadow-none focus-visible:ring-0"
                disabled={posting}
                maxLength={2000}
                onChange={(event) => setComment(event.target.value)}
                placeholder={messages.commentPlaceholder}
                value={comment}
              />
              <MentionPicker
                disabled={posting}
                members={staffMembers}
                messages={messages}
                onChange={setMentionedUserIds}
                value={mentionedUserIds}
              />
              {pendingAttachments.length > 0 ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {pendingAttachments.map((attachment) => (
                    <div
                      className="flex min-w-0 items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2"
                      key={attachment.id}
                    >
                      <Icon
                        aria-hidden
                        className="shrink-0 text-violet-600"
                        icon={ImageIcon}
                        size={16}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">
                          {attachment.file.name}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {formatFileSize(attachment.file.size)}
                        </span>
                      </span>
                      <button
                        aria-label={`${messages.removeAttachment} ${attachment.file.name}`}
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        disabled={posting}
                        onClick={() =>
                          setPendingAttachments((current) =>
                            current.filter(
                              (candidate) => candidate.id !== attachment.id,
                            ),
                          )
                        }
                        type="button"
                      >
                        <Icon aria-hidden icon={X} size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <Button
                asChild
                className="mt-1"
                disabled={posting || pendingAttachments.length >= MAX_ATTACHMENTS}
                size="sm"
                variant="ghost"
              >
                <label>
                  <Icon aria-hidden icon={Paperclip} size={14} />
                  {messages.attachAction}
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={posting || pendingAttachments.length >= MAX_ATTACHMENTS}
                    multiple
                    onChange={(event) => {
                      addAttachments(Array.from(event.target.files ?? []));
                      event.target.value = "";
                    }}
                    type="file"
                  />
                </label>
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 border-t bg-muted/30 px-4 py-2.5">
            <p className="text-xs text-muted-foreground">{m.orders.detail.staffOnly}</p>
            <Button
              disabled={!comment.trim() || posting}
              onClick={postComment}
              size="sm"
              type="button"
            >
              {posting ? <Icon aria-hidden className="animate-spin" icon={LoaderCircle} size={14} /> : null}
              {posting ? messages.posting : messages.postAction}
            </Button>
          </div>
        </CardContent>
      </Card>

      {groups.length === 0 ? (
        <Card className="rounded-xl py-8 text-center text-sm text-muted-foreground shadow-none">
          {messages.empty}
        </Card>
      ) : (
        <div className="space-y-5 px-1 pt-1">
          {groups.map(([label, groupItems]) => (
            <section className="space-y-3" key={label}>
              <h3 className="ml-12 text-xs font-semibold text-muted-foreground">{label}</h3>
              <ol className="relative space-y-4 before:absolute before:bottom-4 before:left-[17px] before:top-4 before:w-px before:bg-border">
                {groupItems.map((item) => {
                  const visual = getTimelineVisual(item);
                  const isEditing = editingId === item.id;
                  return (
                    <li className="relative grid grid-cols-[36px_1fr] gap-3" key={item.id}>
                      <span className={cn("z-10 flex size-9 items-center justify-center rounded-full border", nodeToneClasses[visual.tone])}>
                        <Icon aria-hidden icon={visual.icon} size={16} />
                      </span>
                      <div className={cn("min-w-0 pt-1 text-sm", item.kind === "comment" && "rounded-xl border bg-card p-4 pt-4 shadow-none")}>
                        {item.kind === "comment" ? (
                          <>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold">{item.actorDisplayName || messages.systemActor}</p>
                                <time className="text-xs text-muted-foreground">{formatDateTime(item.occurredAt)}</time>
                              </div>
                              {!isEditing && (item.canEdit || item.canDelete) ? (
                                <div className="flex shrink-0 gap-1">
                                  {item.canEdit ? (
                                    <Button aria-label={messages.editAction} onClick={() => beginEdit(item)} size="icon-sm" type="button" variant="ghost">
                                      <Icon aria-hidden icon={Pencil} size={14} />
                                    </Button>
                                  ) : null}
                                  {item.canDelete ? (
                                    <Button aria-label={messages.deleteAction} className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(item)} size="icon-sm" type="button" variant="ghost">
                                      <Icon aria-hidden icon={Trash2} size={14} />
                                    </Button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>

                            {isEditing ? (
                              <div className="mt-3 space-y-3">
                                <Textarea disabled={savingId === item.id} maxLength={2000} onChange={(event) => setEditingBody(event.target.value)} value={editingBody} />
                                <MentionPicker disabled={savingId === item.id} members={staffMembers} messages={messages} onChange={setEditingMentionIds} value={editingMentionIds} />
                                <div className="flex justify-end gap-2">
                                  <Button disabled={savingId === item.id} onClick={cancelEdit} size="sm" type="button" variant="outline">{messages.cancelAction}</Button>
                                  <Button disabled={!editingBody.trim() || savingId === item.id} onClick={() => saveEdit(item)} size="sm" type="button">
                                    {savingId === item.id ? <Icon aria-hidden className="animate-spin" icon={LoaderCircle} size={14} /> : null}
                                    {savingId === item.id ? messages.saving : messages.saveAction}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="mt-2 whitespace-pre-wrap text-foreground/90">{item.body}</p>
                                {item.mentions.length > 0 ? (
                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                    {item.mentions.map((mention) => (
                                      <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200" key={mention.userId}>@{mention.displayName}</span>
                                    ))}
                                  </div>
                                ) : null}
                                {item.attachments.length > 0 ? (
                                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    {item.attachments.map((attachment) => (
                                      <a
                                        className="flex min-w-0 items-center gap-2 rounded-lg border bg-muted/25 px-3 py-2 transition-colors hover:bg-muted/60"
                                        href={attachment.downloadUrl}
                                        key={attachment.id}
                                        rel="noreferrer"
                                        target="_blank"
                                      >
                                        <Icon
                                          aria-hidden
                                          className="shrink-0 text-violet-600"
                                          icon={ImageIcon}
                                          size={17}
                                        />
                                        <span className="min-w-0 flex-1">
                                          <span className="block truncate text-xs font-medium">
                                            {attachment.fileName}
                                          </span>
                                          <span className="block text-[11px] text-muted-foreground">
                                            {formatFileSize(
                                              attachment.sizeBytes,
                                            )}
                                          </span>
                                        </span>
                                        <Icon
                                          aria-hidden
                                          className="shrink-0 text-muted-foreground"
                                          icon={ExternalLink}
                                          size={13}
                                        />
                                      </a>
                                    ))}
                                  </div>
                                ) : null}
                                {item.editedAt ? <p className="mt-2 text-xs text-muted-foreground">{messages.edited}</p> : null}
                              </>
                            )}
                          </>
                        ) : (
                          <div className="flex items-start justify-between gap-4">
                            <p className="leading-6 text-foreground/90">{getEventMessage(item)}</p>
                            <time className="shrink-0 pt-1 text-xs text-muted-foreground">
                              {new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(item.occurredAt))}
                            </time>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}

      {nextCursor ? (
        <div className="flex justify-center pt-2">
          <Button disabled={loadingMore} onClick={loadMore} size="sm" type="button" variant="outline">
            {loadingMore ? <Icon aria-hidden className="animate-spin" icon={LoaderCircle} size={14} /> : null}
            {loadingMore ? messages.loadingMore : messages.loadMore}
          </Button>
        </div>
      ) : null}

      <Dialog onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)} open={Boolean(deleteTarget)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{messages.deleteTitle}</DialogTitle>
            <DialogDescription>{messages.deleteDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button disabled={deleting} onClick={() => setDeleteTarget(null)} type="button" variant="outline">{messages.cancelAction}</Button>
            <Button disabled={deleting} onClick={confirmDelete} type="button" variant="destructive">
              {deleting ? <Icon aria-hidden className="animate-spin" icon={LoaderCircle} size={14} /> : null}
              {deleting ? messages.deleting : messages.deleteConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
