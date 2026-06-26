"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type {
  CreateManualOrderItemRequest,
  CreatePosOrderRequest,
  PosOrderItemSourceType,
} from "@cleanhub/api-client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
} from "@cleanhub/ui";

import { Icon } from "@/components/app-shell";
import { posRoutes } from "@/config";

import { createOrderAction } from "../actions";

type ManualItemForm = CreateManualOrderItemRequest & {
  key: string;
};

const SOURCE_TYPE_OPTIONS: Array<{
  value: Exclude<PosOrderItemSourceType, "ticket_item">;
  label: string;
}> = [
  { value: "product", label: "商品/服务" },
  { value: "subscription", label: "订阅" },
  { value: "delivery_fee", label: "配送费" },
];

function emptyItem(): ManualItemForm {
  return {
    key: `${Date.now()}-${Math.random()}`,
    sourceType: "product",
    sourceId: "",
    itemName: "",
    quantity: "1",
    unitAmount: "0",
  };
}

function toIsoOrNull(value: string): string | null {
  if (!value) {
    return null;
  }
  return new Date(`${value}T23:59:59`).toISOString();
}

function splitIds(value: string): string[] | undefined {
  const ids = value
    .split(/[\s,，]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}

export function OrderCreateDialog({
  defaultBranchId,
}: {
  defaultBranchId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [orderType, setOrderType] = useState<"manual" | "ticket">("manual");
  const [branchId, setBranchId] = useState(defaultBranchId ?? "");
  const [customerId, setCustomerId] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [ticketItemIds, setTicketItemIds] = useState("");
  const [expireAt, setExpireAt] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ManualItemForm[]>([emptyItem()]);

  function updateItem(index: number, patch: Partial<ManualItemForm>) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function buildPayload(): CreatePosOrderRequest | null {
    const normalizedNotes = notes.trim() || null;
    if (orderType === "ticket") {
      if (!ticketId.trim()) {
        toast.error("请填写工单 ID。");
        return null;
      }
      return {
        orderType: "ticket",
        ticketId: ticketId.trim(),
        ticketItemIds: splitIds(ticketItemIds),
        expireAt: toIsoOrNull(expireAt),
        notes: normalizedNotes,
      };
    }

    if (!branchId.trim() || !customerId.trim()) {
      toast.error("请填写门店 ID 和客户档案 ID。");
      return null;
    }

    const normalizedItems = items.map((item) => ({
      sourceType: item.sourceType,
      sourceId: item.sourceId.trim(),
      itemName: item.itemName.trim(),
      quantity: item.quantity.trim(),
      unitAmount: item.unitAmount.trim(),
    }));

    if (
      normalizedItems.some(
        (item) =>
          !item.sourceId ||
          !item.itemName ||
          Number(item.quantity) <= 0 ||
          Number(item.unitAmount) <= 0,
      )
    ) {
      toast.error("请完整填写订单条目。");
      return null;
    }

    return {
      orderType: "manual",
      branchId: branchId.trim(),
      customerId: customerId.trim(),
      items: normalizedItems,
      expireAt: toIsoOrNull(expireAt),
      notes: normalizedNotes,
    };
  }

  function submit() {
    const payload = buildPayload();
    if (!payload) {
      return;
    }

    startTransition(async () => {
      const result = await createOrderAction(payload);
      if (result.ok && result.data) {
        toast.success("订单已创建。");
        setOpen(false);
        router.push(posRoutes.orderDetail(result.data.id));
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <>
      <button
        className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Icon className="h-4 w-4" name="plus" />
        新增订单
      </button>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>新增订单</DialogTitle>
          </DialogHeader>

          <div className="grid gap-5">
            <div className="inline-grid w-fit grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
              {(["manual", "ticket"] as const).map((value) => (
                <button
                  className={`h-9 rounded-md px-4 text-sm font-semibold ${
                    orderType === value
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  key={value}
                  onClick={() => setOrderType(value)}
                  type="button"
                >
                  {value === "manual" ? "普通订单" : "工单订单"}
                </button>
              ))}
            </div>

            {orderType === "manual" ? (
              <ManualOrderFields
                branchId={branchId}
                customerId={customerId}
                items={items}
                onAddItem={() => setItems((current) => [...current, emptyItem()])}
                onBranchIdChange={setBranchId}
                onCustomerIdChange={setCustomerId}
                onRemoveItem={(index) =>
                  setItems((current) =>
                    current.length === 1
                      ? current
                      : current.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
                onUpdateItem={updateItem}
              />
            ) : (
              <TicketOrderFields
                ticketId={ticketId}
                ticketItemIds={ticketItemIds}
                onTicketIdChange={setTicketId}
                onTicketItemIdsChange={setTicketItemIds}
              />
            )}

            <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
              <Field label="过期日期">
                <input
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"
                  onChange={(event) => setExpireAt(event.target.value)}
                  type="date"
                  value={expireAt}
                />
              </Field>
              <Field label="备注">
                <input
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="选填"
                  value={notes}
                />
              </Field>
            </div>
          </div>

          <DialogFooter>
            <button
              className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700"
              disabled={isPending}
              onClick={() => setOpen(false)}
              type="button"
            >
              取消
            </button>
            <button
              className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
              disabled={isPending}
              onClick={submit}
              type="button"
            >
              {isPending ? "创建中..." : "创建订单"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ManualOrderFields({
  branchId,
  customerId,
  items,
  onBranchIdChange,
  onCustomerIdChange,
  onUpdateItem,
  onAddItem,
  onRemoveItem,
}: {
  branchId: string;
  customerId: string;
  items: ManualItemForm[];
  onBranchIdChange: (value: string) => void;
  onCustomerIdChange: (value: string) => void;
  onUpdateItem: (index: number, patch: Partial<ManualItemForm>) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="门店 ID"
          onChange={onBranchIdChange}
          placeholder="当前门店 ULID"
          value={branchId}
        />
        <TextField
          label="客户档案 ID"
          onChange={onCustomerIdChange}
          placeholder="客户档案 ULID"
          value={customerId}
        />
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="text-sm font-semibold text-slate-800">订单条目</div>
          <button
            className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            onClick={onAddItem}
            type="button"
          >
            <Icon className="h-3.5 w-3.5" name="plus" />
            添加条目
          </button>
        </div>
        <div className="grid gap-3 p-4">
          {items.map((item, index) => (
            <div
              className="grid min-w-0 gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-2 xl:grid-cols-[130px_minmax(0,1fr)_minmax(0,1.2fr)_90px_110px_36px]"
              key={item.key}
            >
              <label>
                <span className="mb-1 block text-xs font-semibold text-slate-500">
                  来源
                </span>
                <select
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none"
                  onChange={(event) =>
                    onUpdateItem(index, {
                      sourceType: event.target.value as ManualItemForm["sourceType"],
                    })
                  }
                  value={item.sourceType}
                >
                  {SOURCE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <TextField
                label="来源 ID"
                onChange={(value) => onUpdateItem(index, { sourceId: value })}
                placeholder="ULID"
                value={item.sourceId}
              />
              <TextField
                label="项目名称"
                onChange={(value) => onUpdateItem(index, { itemName: value })}
                placeholder="如洗衣服务"
                value={item.itemName}
              />
              <TextField
                label="数量"
                onChange={(value) => onUpdateItem(index, { quantity: value })}
                value={item.quantity}
              />
              <TextField
                label="单价"
                onChange={(value) => onUpdateItem(index, { unitAmount: value })}
                value={item.unitAmount}
              />
              <button
                aria-label="删除条目"
                className="mt-5 flex h-10 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 md:mt-0 md:self-end xl:mt-5"
                disabled={items.length === 1}
                onClick={() => onRemoveItem(index)}
                title="删除条目"
                type="button"
              >
                <Icon className="h-4 w-4" name="trash" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TicketOrderFields({
  ticketId,
  ticketItemIds,
  onTicketIdChange,
  onTicketItemIdsChange,
}: {
  ticketId: string;
  ticketItemIds: string;
  onTicketIdChange: (value: string) => void;
  onTicketItemIdsChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <TextField
        label="工单 ID"
        onChange={onTicketIdChange}
        placeholder="服务工单 ULID"
        value={ticketId}
      />
      <TextField
        label="工单项目 ID"
        onChange={onTicketItemIdsChange}
        placeholder="选填，多个 ID 用逗号或空格分隔"
        value={ticketItemIds}
      />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <input
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </Field>
  );
}
