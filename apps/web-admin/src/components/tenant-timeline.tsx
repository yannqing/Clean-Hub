"use client";

import type { TenantUserSummary } from "@cleanhub/api-client";
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
  Check,
  CircleDot,
  ExternalLink,
  ImageIcon,
  Link2,
  LoaderCircle,
  MessageSquareText,
  Paperclip,
  Pencil,
  Search,
  Smile,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useTenantI18n } from "@/i18n";

type TimelineIcon = typeof CircleDot;
export type TenantTimelineTone =
  | "neutral"
  | "info"
  | "warning"
  | "success"
  | "danger"
  | "purple";
export type TenantTimelineDataValue = string | number | boolean | null;
export type TenantTimelineMention = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
};
export type TenantTimelineAttachment = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  downloadUrl: string;
  expiresAt: string;
};
export type TenantTimelineItem = {
  id: string;
  kind: "system" | "comment";
  source: string;
  eventType: string;
  actorUserId: string | null;
  actorDisplayName: string | null;
  actorAvatarUrl: string | null;
  data: Record<string, TenantTimelineDataValue>;
  body: string | null;
  editedAt: string | null;
  version: number | null;
  mentions: TenantTimelineMention[];
  attachments: TenantTimelineAttachment[];
  canEdit: boolean;
  canDelete: boolean;
  occurredAt: string;
};
export type TenantTimelineResponse = {
  data: TenantTimelineItem[];
  nextCursor: string | null;
};
export type TenantTimelineMessages = {
  title: string;
  commentPlaceholder: string;
  postAction: string;
  posting: string;
  loadMore: string;
  loadingMore: string;
  empty: string;
  loadError: string;
  postError: string;
  editAction: string;
  deleteAction: string;
  saveAction: string;
  cancelAction: string;
  saving: string;
  deleting: string;
  editError: string;
  deleteError: string;
  deleteTitle: string;
  deleteDescription: string;
  deleteConfirm: string;
  emojiAction: string;
  mentionAction: string;
  referencePageAction: string;
  mentionSearchPlaceholder: string;
  noMentionResults: string;
  removeMention: string;
  attachAction: string;
  attachmentTypeInvalid: string;
  attachmentTooLarge: string;
  attachmentLimit: string;
  attachmentUploadFailed: string;
  removeAttachment: string;
  systemActor: string;
  edited: string;
  today: string;
  yesterday: string;
};
export type TenantTimelineVisual = {
  icon: TimelineIcon;
  tone: TenantTimelineTone;
};

type CommentInput = {
  body: string;
  idempotencyKey: string;
  mentionedUserIds?: string[];
  attachments?: Array<{ objectKey: string; fileName: string }>;
};
type UpdateCommentInput = {
  body: string;
  version: number;
  mentionedUserIds?: string[];
};
type TimelineMutationResult =
  | { ok: true; data: TenantTimelineItem }
  | { ok: false; message: string };
type TimelineDeleteResult = { ok: true } | { ok: false; message: string };
type TimelineUploadResult =
  | {
      ok: true;
      ticket: {
        objectKey: string;
        uploadUrl: string;
        headers: Record<string, string>;
        expiresAt: string;
      };
    }
  | { ok: false; reason: "missing" | "type" | "size" | "upload" };

type PendingAttachment = {
  id: string;
  file: File;
  objectKey?: string;
  expiresAt?: string;
};

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const EMOJI_OPTIONS = [
  "😀",
  "😃",
  "😄",
  "😁",
  "😆",
  "😅",
  "😂",
  "🤣",
  "😊",
  "🙂",
  "😉",
  "😍",
  "🥰",
  "😘",
  "😎",
  "🤩",
  "🤔",
  "🫡",
  "😌",
  "😴",
  "😢",
  "😭",
  "😤",
  "😡",
  "👍",
  "👎",
  "👌",
  "✌️",
  "🤞",
  "🤝",
  "👏",
  "🙌",
  "🙏",
  "💪",
  "👀",
  "💡",
  "❤️",
  "🧡",
  "💛",
  "💚",
  "💙",
  "💜",
  "🖤",
  "🤍",
  "✅",
  "❌",
  "⚠️",
  "❓",
  "🎉",
  "🎊",
  "🎁",
  "🏆",
  "⭐",
  "✨",
  "🔥",
  "💯",
  "📌",
  "📦",
  "🚚",
  "🧾",
  "💳",
  "💰",
  "🧼",
  "🧺",
];
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

function formatMentionDisplayName(displayName: string): string {
  const normalizedName = displayName
    .trim()
    .replace(/^[@＠]+/u, "")
    .trimStart();
  return `@${normalizedName}`;
}

function PendingAttachmentPreview({
  attachment,
  disabled,
  messages,
  onRemove,
}: {
  attachment: PendingAttachment;
  disabled: boolean;
  messages: TenantTimelineMessages;
  onRemove: () => void;
}) {
  const previewUrl = useMemo(
    () => URL.createObjectURL(attachment.file),
    [attachment.file],
  );

  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  return (
    <div className="group relative min-w-0 overflow-hidden rounded-lg border bg-muted/25">
      <div className="aspect-[4/3] overflow-hidden bg-muted">
        {/* The source is a short-lived local object URL, so Next image
        optimization would not provide any benefit here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={attachment.file.name}
          className="h-full w-full object-cover"
          decoding="async"
          src={previewUrl}
        />
      </div>
      <div className="flex min-w-0 items-center gap-2 px-3 py-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">
            {attachment.file.name}
          </span>
          <span className="block text-[11px] text-muted-foreground">
            {formatFileSize(attachment.file.size)}
          </span>
        </span>
      </div>
      <button
        aria-label={`${messages.removeAttachment} ${attachment.file.name}`}
        className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-background hover:text-foreground"
        disabled={disabled}
        onClick={onRemove}
        type="button"
      >
        <Icon aria-hidden icon={X} size={13} />
      </button>
    </div>
  );
}

function TimelineAttachmentPreview({
  attachment,
}: {
  attachment: TenantTimelineAttachment;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <a
      aria-label={attachment.fileName}
      className="group min-w-0 overflow-hidden rounded-lg border bg-muted/25 transition-colors hover:bg-muted/50"
      href={attachment.downloadUrl}
      rel="noreferrer"
      target="_blank"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {failed ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
            <Icon aria-hidden icon={ImageIcon} size={24} />
            <span className="text-xs">{attachment.fileName}</span>
          </div>
        ) : (
          // The API returns a short-lived signed URL whose host can vary by
          // storage provider, so this image intentionally bypasses Next's
          // host-based optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={attachment.fileName}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            decoding="async"
            loading="lazy"
            onError={() => setFailed(true)}
            src={attachment.downloadUrl}
          />
        )}
        {!failed ? (
          <span className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 text-muted-foreground opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Icon aria-hidden icon={ExternalLink} size={13} />
          </span>
        ) : null}
      </div>
      <span className="flex min-w-0 items-center gap-2 px-3 py-2">
        <Icon
          aria-hidden
          className="shrink-0 text-violet-600"
          icon={ImageIcon}
          size={15}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">
            {attachment.fileName}
          </span>
          <span className="block text-[11px] text-muted-foreground">
            {formatFileSize(attachment.sizeBytes)}
          </span>
        </span>
      </span>
    </a>
  );
}

const nodeToneClasses: Record<TenantTimelineTone, string> = {
  neutral: "border-slate-200 bg-slate-100 text-slate-600",
  info: "border-sky-200 bg-sky-100 text-sky-700",
  warning: "border-amber-200 bg-amber-100 text-amber-800",
  success: "border-emerald-200 bg-emerald-100 text-emerald-700",
  danger: "border-red-200 bg-red-100 text-red-700",
  purple: "border-violet-200 bg-violet-100 text-violet-700",
};

function MentionChips({
  disabled,
  members,
  messages,
  onChange,
  value,
}: {
  disabled?: boolean;
  members: TenantUserSummary[];
  messages: TenantTimelineMessages;
  onChange: (userIds: string[]) => void;
  value: string[];
}) {
  const selectedMembers = value.flatMap((userId) => {
    const member = members.find((candidate) => candidate.id === userId);
    return member ? [member] : [];
  });

  if (selectedMembers.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {selectedMembers.map((member) => (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-1 text-xs font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200"
          key={member.id}
        >
          {formatMentionDisplayName(member.displayName)}
          <button
            aria-label={`${messages.removeMention} ${member.displayName}`}
            className="rounded-full p-0.5 hover:bg-violet-200 dark:hover:bg-violet-900"
            disabled={disabled}
            onClick={() =>
              onChange(value.filter((candidate) => candidate !== member.id))
            }
            type="button"
          >
            <Icon aria-hidden icon={X} size={11} />
          </button>
        </span>
      ))}
    </div>
  );
}

function EmojiPicker({
  disabled,
  messages,
  onSelect,
}: {
  disabled?: boolean;
  messages: TenantTimelineMessages;
  onSelect: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-label={messages.emojiAction}
          className="size-7 rounded-md"
          disabled={disabled}
          size="icon-sm"
          title={messages.emojiAction}
          type="button"
          variant="ghost"
        >
          <Icon aria-hidden icon={Smile} size={15} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto">
          {EMOJI_OPTIONS.map((emoji) => (
            <Button
              aria-label={emoji}
              className="size-8 text-base"
              key={emoji}
              onClick={() => {
                onSelect(emoji);
                setOpen(false);
              }}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              {emoji}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MentionPicker({
  compact = false,
  disabled,
  members,
  messages,
  onChange,
  showSelected = true,
  value,
}: {
  compact?: boolean;
  disabled?: boolean;
  members: TenantUserSummary[];
  messages: TenantTimelineMessages;
  onChange: (userIds: string[]) => void;
  showSelected?: boolean;
  value: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
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
    <div className={cn(showSelected && "space-y-2")}>
      {showSelected ? (
        <MentionChips
          disabled={disabled}
          members={members}
          messages={messages}
          onChange={onChange}
          value={value}
        />
      ) : null}

      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button
            aria-label={compact ? messages.mentionAction : undefined}
            className={compact ? "size-7 rounded-md" : undefined}
            disabled={disabled}
            size={compact ? "icon-sm" : "sm"}
            title={compact ? messages.mentionAction : undefined}
            type="button"
            variant="ghost"
          >
            <Icon aria-hidden icon={AtSign} size={15} />
            {compact ? null : messages.mentionAction}
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
                      {selected ? (
                        <Icon aria-hidden icon={Check} size={13} />
                      ) : null}
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

export function TenantTimeline({
  createComment,
  deleteComment,
  getEventMessage,
  getItemVisual,
  initialTimeline,
  loadTimeline,
  messages,
  staffMembers,
  staffOnlyText,
  titleId = "tenant-timeline-title",
  updateComment,
  uploadAttachment,
}: {
  createComment: (input: CommentInput) => Promise<TimelineMutationResult>;
  deleteComment: (
    commentId: string,
    version: number,
  ) => Promise<TimelineDeleteResult>;
  getEventMessage: (item: TenantTimelineItem) => string;
  getItemVisual: (item: TenantTimelineItem) => TenantTimelineVisual;
  initialTimeline: TenantTimelineResponse;
  loadTimeline: (query: {
    cursor: string;
    limit: number;
  }) => Promise<TenantTimelineResponse>;
  messages: TenantTimelineMessages;
  staffMembers: TenantUserSummary[];
  staffOnlyText: string;
  titleId?: string;
  updateComment: (
    commentId: string,
    input: UpdateCommentInput,
  ) => Promise<TimelineMutationResult>;
  uploadAttachment: (input: {
    contentType: string;
    sizeBytes: number;
  }) => Promise<TimelineUploadResult>;
}) {
  const { formatDate, formatDateTime, locale } = useTenantI18n();
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
  const [deleteTarget, setDeleteTarget] = useState<TenantTimelineItem | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

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
    const grouped = new Map<string, TenantTimelineItem[]>();
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
      (file) => !existing.has(`${file.name}:${file.size}:${file.lastModified}`),
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

  function appendToComment(value: string, separateWithNewline = false) {
    setComment((current) => {
      const separator =
        separateWithNewline && current.length > 0 && !/\s$/u.test(current)
          ? "\n"
          : "";
      return `${current}${separator}${value}`.slice(0, 2000);
    });
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

      const result = await uploadAttachment({
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
      const result = await createComment({
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

  function beginEdit(item: TenantTimelineItem) {
    setEditingId(item.id);
    setEditingBody(item.body ?? "");
    setEditingMentionIds(item.mentions.map((mention) => mention.userId));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingBody("");
    setEditingMentionIds([]);
  }

  async function saveEdit(item: TenantTimelineItem) {
    const body = editingBody.trim();
    if (!body || item.version === null || savingId) return;
    setSavingId(item.id);
    try {
      const result = await updateComment(item.id, {
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
      const result = await deleteComment(deleteTarget.id, deleteTarget.version);
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
      const result = await loadTimeline({
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
    <section aria-labelledby={titleId} className="space-y-3">
      <h2 className="px-1 text-base font-semibold" id={titleId}>
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
              <MentionChips
                disabled={posting}
                members={staffMembers}
                messages={messages}
                onChange={setMentionedUserIds}
                value={mentionedUserIds}
              />
              {pendingAttachments.length > 0 ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {pendingAttachments.map((attachment) => (
                    <PendingAttachmentPreview
                      attachment={attachment}
                      disabled={posting}
                      key={attachment.id}
                      messages={messages}
                      onRemove={() =>
                        setPendingAttachments((current) =>
                          current.filter(
                            (candidate) => candidate.id !== attachment.id,
                          ),
                        )
                      }
                    />
                  ))}
                </div>
              ) : null}
              <div className="mt-3 flex items-center justify-between gap-3 border-t pt-2">
                <div className="flex items-center">
                  <EmojiPicker
                    disabled={posting}
                    messages={messages}
                    onSelect={(emoji) => appendToComment(emoji)}
                  />
                  <MentionPicker
                    compact
                    disabled={posting}
                    members={staffMembers}
                    messages={messages}
                    onChange={setMentionedUserIds}
                    showSelected={false}
                    value={mentionedUserIds}
                  />
                  <Button
                    aria-label={messages.referencePageAction}
                    className="size-7 rounded-md"
                    disabled={posting}
                    onClick={() => appendToComment(window.location.href, true)}
                    size="icon-sm"
                    title={messages.referencePageAction}
                    type="button"
                    variant="ghost"
                  >
                    <Icon aria-hidden icon={Link2} size={15} />
                  </Button>
                  <Button
                    asChild
                    className="size-7 rounded-md"
                    disabled={
                      posting || pendingAttachments.length >= MAX_ATTACHMENTS
                    }
                    size="icon-sm"
                    variant="ghost"
                  >
                    <label
                      aria-label={messages.attachAction}
                      title={messages.attachAction}
                    >
                      <Icon aria-hidden icon={Paperclip} size={15} />
                      <input
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        disabled={
                          posting ||
                          pendingAttachments.length >= MAX_ATTACHMENTS
                        }
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
                <Button
                  className="h-7 px-3"
                  disabled={!comment.trim() || posting}
                  onClick={postComment}
                  size="sm"
                  type="button"
                >
                  {posting ? (
                    <Icon
                      aria-hidden
                      className="animate-spin"
                      icon={LoaderCircle}
                      size={14}
                    />
                  ) : null}
                  {posting ? messages.posting : messages.postAction}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {staffOnlyText}
              </p>
            </div>
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
              <h3 className="ml-12 text-xs font-semibold text-muted-foreground">
                {label}
              </h3>
              <ol className="relative space-y-4 before:absolute before:bottom-4 before:left-[17px] before:top-4 before:w-px before:bg-border">
                {groupItems.map((item) => {
                  const visual = getItemVisual(item);
                  const isEditing = editingId === item.id;
                  return (
                    <li
                      className="relative grid grid-cols-[36px_1fr] gap-3"
                      key={item.id}
                    >
                      <span
                        className={cn(
                          "z-10 flex size-9 items-center justify-center rounded-full border",
                          nodeToneClasses[visual.tone],
                        )}
                      >
                        <Icon aria-hidden icon={visual.icon} size={16} />
                      </span>
                      <div
                        className={cn(
                          "min-w-0 pt-1 text-sm",
                          item.kind === "comment" &&
                            "rounded-xl border bg-card p-4 pt-4 shadow-none",
                        )}
                      >
                        {item.kind === "comment" ? (
                          <>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold">
                                  {item.actorDisplayName ||
                                    messages.systemActor}
                                </p>
                                <time className="text-xs text-muted-foreground">
                                  {formatDateTime(item.occurredAt)}
                                </time>
                              </div>
                              {!isEditing &&
                              (item.canEdit || item.canDelete) ? (
                                <div className="flex shrink-0 gap-1">
                                  {item.canEdit ? (
                                    <Button
                                      aria-label={messages.editAction}
                                      onClick={() => beginEdit(item)}
                                      size="icon-sm"
                                      type="button"
                                      variant="ghost"
                                    >
                                      <Icon
                                        aria-hidden
                                        icon={Pencil}
                                        size={14}
                                      />
                                    </Button>
                                  ) : null}
                                  {item.canDelete ? (
                                    <Button
                                      aria-label={messages.deleteAction}
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => setDeleteTarget(item)}
                                      size="icon-sm"
                                      type="button"
                                      variant="ghost"
                                    >
                                      <Icon
                                        aria-hidden
                                        icon={Trash2}
                                        size={14}
                                      />
                                    </Button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>

                            {isEditing ? (
                              <div className="mt-3 space-y-3">
                                <Textarea
                                  disabled={savingId === item.id}
                                  maxLength={2000}
                                  onChange={(event) =>
                                    setEditingBody(event.target.value)
                                  }
                                  value={editingBody}
                                />
                                <MentionPicker
                                  disabled={savingId === item.id}
                                  members={staffMembers}
                                  messages={messages}
                                  onChange={setEditingMentionIds}
                                  value={editingMentionIds}
                                />
                                <div className="flex justify-end gap-2">
                                  <Button
                                    disabled={savingId === item.id}
                                    onClick={cancelEdit}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                  >
                                    {messages.cancelAction}
                                  </Button>
                                  <Button
                                    disabled={
                                      !editingBody.trim() ||
                                      savingId === item.id
                                    }
                                    onClick={() => saveEdit(item)}
                                    size="sm"
                                    type="button"
                                  >
                                    {savingId === item.id ? (
                                      <Icon
                                        aria-hidden
                                        className="animate-spin"
                                        icon={LoaderCircle}
                                        size={14}
                                      />
                                    ) : null}
                                    {savingId === item.id
                                      ? messages.saving
                                      : messages.saveAction}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="mt-2 whitespace-pre-wrap text-foreground/90">
                                  {item.body}
                                </p>
                                {item.mentions.length > 0 ? (
                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                    {item.mentions.map((mention) => (
                                      <span
                                        className="rounded-full bg-violet-100 px-2 py-1 text-xs font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200"
                                        key={mention.userId}
                                      >
                                        {formatMentionDisplayName(
                                          mention.displayName,
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                                {item.attachments.length > 0 ? (
                                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    {item.attachments.map((attachment) => (
                                      <TimelineAttachmentPreview
                                        attachment={attachment}
                                        key={attachment.id}
                                      />
                                    ))}
                                  </div>
                                ) : null}
                                {item.editedAt ? (
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    {messages.edited}
                                  </p>
                                ) : null}
                              </>
                            )}
                          </>
                        ) : (
                          <div className="flex items-start justify-between gap-4">
                            <p className="leading-6 text-foreground/90">
                              {getEventMessage(item)}
                            </p>
                            <time className="shrink-0 pt-1 text-xs text-muted-foreground">
                              {new Intl.DateTimeFormat(locale, {
                                hour: "2-digit",
                                minute: "2-digit",
                              }).format(new Date(item.occurredAt))}
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
          <Button
            disabled={loadingMore}
            onClick={loadMore}
            size="sm"
            type="button"
            variant="outline"
          >
            {loadingMore ? (
              <Icon
                aria-hidden
                className="animate-spin"
                icon={LoaderCircle}
                size={14}
              />
            ) : null}
            {loadingMore ? messages.loadingMore : messages.loadMore}
          </Button>
        </div>
      ) : null}

      <Dialog
        onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
        open={Boolean(deleteTarget)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{messages.deleteTitle}</DialogTitle>
            <DialogDescription>{messages.deleteDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
              type="button"
              variant="outline"
            >
              {messages.cancelAction}
            </Button>
            <Button
              disabled={deleting}
              onClick={confirmDelete}
              type="button"
              variant="destructive"
            >
              {deleting ? (
                <Icon
                  aria-hidden
                  className="animate-spin"
                  icon={LoaderCircle}
                  size={14}
                />
              ) : null}
              {deleting ? messages.deleting : messages.deleteConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
