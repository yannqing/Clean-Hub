"use client";

import { posToast as toast } from "@/lib/pos-toast";
import { dateTimeLocalToUtc } from "@cleanhub/domain/timezone";
import { useEffect, useState } from "react";

import type {
  ServiceTicketPriority,
  ServiceTicketSourceChannel,
  ServiceTicketType,
} from "@cleanhub/api-client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cleanhub/ui";

import { posApi } from "@/lib/api-client";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";

type ServiceTicketCreateDialogProps = {
  open: boolean;
  customerId: string;
  customerName: string;
  onOpenChange: (open: boolean) => void;
  /** Called with the created ticket id after a successful create. */
  onCreated: (ticketId: string) => void;
};

const TYPE_OPTIONS: ReadonlyArray<{ value: ServiceTicketType; label: string }> =
  [
    { value: "laundry", label: "洗衣护理" },
    { value: "car_wash", label: "车辆清洗" },
  ];

const PRIORITY_OPTIONS: ReadonlyArray<{
  value: ServiceTicketPriority;
  label: string;
}> = [
  { value: "normal", label: "普通" },
  { value: "urgent", label: "加急" },
  { value: "critical", label: "最紧急" },
];

const CHANNEL_OPTIONS: ReadonlyArray<{
  value: ServiceTicketSourceChannel;
  label: string;
}> = [
  { value: "pos", label: "POS" },
  { value: "app", label: "客户端App" },
  { value: "phone", label: "电话" },
  { value: "whatsapp", label: "WhatsApp" },
];

type FormValues = {
  ticketType: ServiceTicketType;
  priority: ServiceTicketPriority;
  sourceChannel: ServiceTicketSourceChannel;
  expectedPickupAt: string; // datetime-local value, "" when cleared
  remark: string;
};

const EMPTY_FORM: FormValues = {
  ticketType: "laundry",
  priority: "normal",
  sourceChannel: "pos",
  expectedPickupAt: "",
  remark: "",
};

/**
 * 新建服务工单 dialog. Mirrors the prototype modal fields (ticket type /
 * priority / expected pickup / source channel / remark). The branchId required
 * by the backend is resolved client-side via `posApi.pos.branches.getMine()`
 * — deliberately NOT via the server-only `getMyBranchQuery`, which would pull
 * `next/headers` into the client bundle and break the build.
 */
export function ServiceTicketCreateDialog({
  open,
  customerId,
  customerName,
  onOpenChange,
  onCreated,
}: ServiceTicketCreateDialogProps) {
  const { timeZone } = usePosRuntimeConfig();
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branchLoading, setBranchLoading] = useState(false);

  // Resolve the active branch when the dialog opens. Called client-side so the
  // auth cookies travel automatically (posApi uses credentials: include).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    if (branchId) return; // already resolved this session
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; setState happens in the async continuation.
    setBranchLoading(true);
    posApi.pos.branches
      .getMine()
      .then((branch) => {
        if (!cancelled) setBranchId(branch?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setBranchId(null);
      })
      .finally(() => {
        if (!cancelled) setBranchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, branchId]);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit() {
    if (!branchId) {
      toast.error("无法确定当前门店，请先绑定门店后再创建工单。");
      return;
    }
    const expectedPickupAt = form.expectedPickupAt
      ? dateTimeLocalToUtc(form.expectedPickupAt, timeZone)
      : null;
    if (form.expectedPickupAt && !expectedPickupAt) {
      toast.error("预计取件时间无效。");
      return;
    }
    setSubmitting(true);
    try {
      const ticket = await posApi.pos.serviceTickets.create({
        customerId,
        branchId,
        ticketType: form.ticketType,
        priority: form.priority,
        sourceChannel: form.sourceChannel,
        expectedPickupAt: expectedPickupAt?.toISOString(),
        remark: form.remark.trim() || undefined,
      });
      toast.success("服务工单已创建");
      onCreated(ticket.id);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "创建工单失败，请重试。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl gap-5 overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle>新建服务工单</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          为 {customerName} 创建工单，项目与价格将在下一步添加。
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="工单类型">
            <select
              className={inputClass}
              onChange={(event) =>
                update("ticketType", event.target.value as ServiceTicketType)
              }
              value={form.ticketType}
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="优先级">
            <select
              className={inputClass}
              onChange={(event) =>
                update("priority", event.target.value as ServiceTicketPriority)
              }
              value={form.priority}
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="预计取件时间">
            <input
              className={inputClass}
              onChange={(event) =>
                update("expectedPickupAt", event.target.value)
              }
              type="datetime-local"
              value={form.expectedPickupAt}
            />
          </FormField>
          <FormField label="来源渠道">
            <select
              className={inputClass}
              onChange={(event) =>
                update(
                  "sourceChannel",
                  event.target.value as ServiceTicketSourceChannel,
                )
              }
              value={form.sourceChannel}
            >
              {CHANNEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="备注" wide>
            <textarea
              className={`${inputClass} min-h-[90px]`}
              maxLength={2000}
              onChange={(event) => update("remark", event.target.value)}
              placeholder="通用服务备注"
              value={form.remark}
            />
          </FormField>
        </div>

        <DialogFooter>
          <button
            className="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            disabled={submitting}
            type="button"
            onClick={() => onOpenChange(false)}
          >
            取消
          </button>
          <button
            className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            disabled={submitting || branchLoading || !branchId}
            type="button"
            onClick={handleSubmit}
          >
            {submitting ? "创建中…" : branchLoading ? "加载门店…" : "创建工单"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20";

function FormField({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
