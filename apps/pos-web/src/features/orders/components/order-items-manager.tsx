"use client";

import { useState, useTransition } from "react";
import { posToast as toast } from "@/lib/pos-toast";
import { useRouter } from "next/navigation";
import type {
  PosOrderDetail,
  PosOrderItem,
  PosOrderItemSourceType,
} from "@cleanhub/api-client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cleanhub/ui";

import { Icon } from "@/components/app-shell";

import {
  createOrderItemAction,
  deleteOrderItemAction,
  updateOrderItemAction,
} from "../actions";
import { formatOrderMoney } from "../constants";

type ItemDraft = {
  sourceType: Exclude<PosOrderItemSourceType, "ticket_item">;
  sourceId: string;
  itemName: string;
  quantity: string;
  unitAmount: string;
};

type ItemDialogMode = { type: "create" } | { type: "edit"; item: PosOrderItem };

const SOURCE_TYPE_OPTIONS: Array<{
  value: ItemDraft["sourceType"];
  label: string;
}> = [
  { value: "product", label: "商品/服务" },
  { value: "subscription", label: "订阅" },
  { value: "delivery_fee", label: "配送费" },
];

const EMPTY_DRAFT: ItemDraft = {
  sourceType: "product",
  sourceId: "",
  itemName: "",
  quantity: "1",
  unitAmount: "0",
};

export function OrderItemsManager({ order }: { order: PosOrderDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [itemDialog, setItemDialog] = useState<ItemDialogMode | null>(null);
  const canEdit =
    Number(order.paidAmount) === 0 &&
    order.status !== "paid" &&
    order.status !== "delivered" &&
    order.status !== "cancelled";

  function removeItem(itemId: string) {
    startTransition(async () => {
      const result = await deleteOrderItemAction(order.id, itemId);
      if (result.ok) {
        toast.success("订单条目已删除。");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="font-semibold text-slate-950">订单条目</h2>
          <p className="mt-1 text-xs text-slate-500">
            基于工单创建的订单会保留金额快照。
          </p>
        </div>
        {canEdit ? (
          <button
            className="flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            disabled={isPending}
            onClick={() => setItemDialog({ type: "create" })}
            type="button"
          >
            <Icon className="h-4 w-4" name="plus" />
            新增条目
          </button>
        ) : (
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
            当前不可编辑
          </span>
        )}
      </div>

      <div className="divide-y divide-slate-100 min-[1400px]:hidden">
        {order.items.map((item) => (
          <ReadOnlyItemCard
            canEdit={canEdit}
            currency={order.currency}
            disabled={isPending}
            item={item}
            key={item.id}
            onDelete={() => removeItem(item.id)}
            onEdit={() => setItemDialog({ type: "edit", item })}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto min-[1400px]:block">
        <div className="min-w-[820px]">
          <div className="grid grid-cols-[minmax(220px,1fr)_100px_120px_120px_120px] bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            <div>项目</div>
            <div>数量</div>
            <div>单价</div>
            <div className="text-right">小计</div>
            <div className="text-right">操作</div>
          </div>
          {order.items.map((item) => (
            <ReadOnlyItemRow
              canEdit={canEdit}
              currency={order.currency}
              disabled={isPending}
              item={item}
              key={item.id}
              onDelete={() => removeItem(item.id)}
              onEdit={() => setItemDialog({ type: "edit", item })}
            />
          ))}
        </div>
      </div>

      {itemDialog ? (
        <OrderItemDialog
          currency={order.currency}
          disabled={isPending}
          key={
            itemDialog.type === "edit" ? `edit-${itemDialog.item.id}` : "create"
          }
          mode={itemDialog}
          onClose={() => setItemDialog(null)}
          onSaved={() => {
            setItemDialog(null);
            router.refresh();
          }}
          orderId={order.id}
        />
      ) : null}
    </section>
  );
}

function ReadOnlyItemCard({
  item,
  canEdit,
  currency,
  disabled,
  onEdit,
  onDelete,
}: {
  item: PosOrderItem;
  canEdit: boolean;
  currency: string;
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="p-4 sm:p-5">
      <div className="min-w-0">
        <div className="text-base font-semibold text-slate-900">
          {item.itemName}
        </div>
        <div className="mt-1 break-all font-mono text-[11px] text-slate-400">
          {item.sourceType} · {item.sourceId}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3">
        <OrderItemCardDetail label="数量" value={String(item.quantity)} />
        <OrderItemCardDetail
          label="单价"
          value={formatOrderMoney(item.unitAmount, currency)}
        />
        <OrderItemCardDetail
          label="小计"
          value={formatOrderMoney(item.lineAmount, currency)}
        />
      </dl>

      <div className="mt-4 flex justify-end gap-2">
        <button
          className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 disabled:opacity-40"
          disabled={!canEdit || disabled}
          onClick={onEdit}
          type="button"
        >
          <Icon className="h-4 w-4" name="square-pen" />
          编辑
        </button>
        <button
          className="flex h-11 items-center gap-2 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-600 disabled:opacity-40"
          disabled={!canEdit || disabled}
          onClick={onDelete}
          type="button"
        >
          <Icon className="h-4 w-4" name="trash" />
          删除
        </button>
      </div>
    </article>
  );
}

function OrderItemDialog({
  orderId,
  mode,
  currency,
  disabled,
  onClose,
  onSaved,
}: {
  orderId: string;
  mode: ItemDialogMode;
  currency: string;
  disabled: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editingItem = mode.type === "edit" ? mode.item : null;
  const [draft, setDraft] = useState<ItemDraft>(() => ({
    ...EMPTY_DRAFT,
    sourceId: editingItem?.sourceId ?? "",
    itemName: editingItem?.itemName ?? "",
    quantity: editingItem?.quantity ?? "1",
    unitAmount: editingItem?.unitAmount ?? "0",
  }));
  const [isPending, startTransition] = useTransition();

  function save() {
    if (!draft.itemName.trim()) {
      toast.error("请填写项目名称。");
      return;
    }

    if (!editingItem && !draft.sourceId.trim()) {
      toast.error("请填写来源 ID。");
      return;
    }

    startTransition(async () => {
      const result = editingItem
        ? await updateOrderItemAction(orderId, editingItem.id, {
            itemName: draft.itemName.trim(),
            quantity: draft.quantity.trim(),
            unitAmount: draft.unitAmount.trim(),
            version: editingItem.version,
          })
        : await createOrderItemAction(orderId, {
            sourceType: draft.sourceType,
            sourceId: draft.sourceId.trim(),
            itemName: draft.itemName.trim(),
            quantity: draft.quantity.trim(),
            unitAmount: draft.unitAmount.trim(),
          });

      if (result.ok) {
        toast.success(editingItem ? "订单条目已保存。" : "订单条目已添加。");
        onSaved();
      } else {
        toast.error(result.message);
      }
    });
  }

  const blocked = disabled || isPending;

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !blocked) {
          onClose();
        }
      }}
      open
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-xl">
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "编辑订单条目" : "新增订单条目"}
            </DialogTitle>
          </DialogHeader>

          {editingItem ? (
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-500">来源</div>
              <div className="mt-1 break-all font-mono text-xs text-slate-700">
                {editingItem.sourceType} · {editingItem.sourceId}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-500">
                  来源
                </span>
                <select
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
                  disabled={blocked}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      sourceType: event.target.value as ItemDraft["sourceType"],
                    }))
                  }
                  value={draft.sourceType}
                >
                  {SOURCE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <SmallInput
                disabled={blocked}
                label="来源 ID"
                onChange={(value) =>
                  setDraft((current) => ({ ...current, sourceId: value }))
                }
                placeholder="ULID"
                value={draft.sourceId}
              />
            </div>
          )}

          <SmallInput
            disabled={blocked}
            label="项目名称"
            onChange={(value) =>
              setDraft((current) => ({ ...current, itemName: value }))
            }
            value={draft.itemName}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <SmallInput
              disabled={blocked}
              label="数量"
              onChange={(value) =>
                setDraft((current) => ({ ...current, quantity: value }))
              }
              value={draft.quantity}
            />
            <SmallInput
              disabled={blocked}
              label="单价"
              onChange={(value) =>
                setDraft((current) => ({ ...current, unitAmount: value }))
              }
              value={draft.unitAmount}
            />
          </div>

          <div className="rounded-lg bg-blue-50 px-4 py-3">
            <div className="text-xs font-semibold text-blue-600">计算小计</div>
            <div className="mt-1 text-lg font-semibold text-blue-950">
              {formatOrderMoney(
                Number(draft.quantity || 0) * Number(draft.unitAmount || 0),
                currency,
              )}
            </div>
          </div>

          <DialogFooter>
            <button
              className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-40"
              disabled={blocked}
              onClick={onClose}
              type="button"
            >
              取消
            </button>
            <button
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
              disabled={blocked}
              type="submit"
            >
              <Icon className="h-4 w-4" name="save" />
              {isPending ? "保存中…" : editingItem ? "保存" : "添加"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OrderItemCardDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

function ReadOnlyItemRow({
  item,
  canEdit,
  currency,
  disabled,
  onEdit,
  onDelete,
}: {
  item: PosOrderItem;
  canEdit: boolean;
  currency: string;
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(220px,1fr)_100px_120px_120px_120px] items-center border-t border-slate-100 px-5 py-4 text-sm">
      <div className="min-w-0">
        <div className="truncate font-semibold text-slate-800">
          {item.itemName}
        </div>
        <div className="mt-1 font-mono text-[11px] text-slate-400">
          {item.sourceType} · {item.sourceId}
        </div>
      </div>
      <div className="font-medium text-slate-600">{item.quantity}</div>
      <div className="font-medium text-slate-600">
        {formatOrderMoney(item.unitAmount, currency)}
      </div>
      <div className="text-right font-semibold text-slate-800">
        {formatOrderMoney(item.lineAmount, currency)}
      </div>
      <div className="flex justify-end gap-1">
        <button
          aria-label="编辑条目"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canEdit || disabled}
          onClick={onEdit}
          title="编辑条目"
          type="button"
        >
          <Icon className="h-4 w-4" name="square-pen" />
        </button>
        <button
          aria-label="删除条目"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canEdit || disabled}
          onClick={onDelete}
          title="删除条目"
          type="button"
        >
          <Icon className="h-4 w-4" name="trash" />
        </button>
      </div>
    </div>
  );
}

function SmallInput({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-500">
        {label}
      </span>
      <input
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-500"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}
