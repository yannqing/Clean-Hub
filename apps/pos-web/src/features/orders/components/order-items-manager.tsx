"use client";

import { useState, useTransition } from "react";
import { posToast as toast } from "@/lib/pos-toast";
import { useRouter } from "next/navigation";
import type {
  PosOrderDetail,
  PosOrderItem,
  PosOrderItemSourceType,
} from "@cleanhub/api-client";

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

const SOURCE_TYPE_OPTIONS: Array<{ value: ItemDraft["sourceType"]; label: string }> =
  [
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
  const [draft, setDraft] = useState<ItemDraft>(EMPTY_DRAFT);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const canEdit =
    Number(order.paidAmount) === 0 &&
    order.status !== "paid" &&
    order.status !== "delivered" &&
    order.status !== "cancelled";

  function addItem() {
    if (!draft.sourceId.trim() || !draft.itemName.trim()) {
      toast.error("请填写来源 ID 和项目名称。");
      return;
    }

    startTransition(async () => {
      const result = await createOrderItemAction(order.id, {
        sourceType: draft.sourceType,
        sourceId: draft.sourceId.trim(),
        itemName: draft.itemName.trim(),
        quantity: draft.quantity.trim(),
        unitAmount: draft.unitAmount.trim(),
      });

      if (result.ok) {
        toast.success("订单条目已添加。");
        setDraft(EMPTY_DRAFT);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

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
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="font-semibold text-slate-950">订单条目</h2>
          <p className="mt-1 text-xs text-slate-500">
            基于工单创建的订单会保留金额快照。
          </p>
        </div>
        {!canEdit ? (
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
            当前不可编辑
          </span>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[820px]">
          <div className="grid grid-cols-[minmax(220px,1fr)_100px_120px_120px_120px] bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            <div>项目</div>
            <div>数量</div>
            <div>单价</div>
            <div className="text-right">小计</div>
            <div className="text-right">操作</div>
          </div>
          {order.items.map((item) =>
            editingItemId === item.id ? (
              <EditableItemRow
                disabled={isPending}
                item={item}
                key={item.id}
                onCancel={() => setEditingItemId(null)}
                onSaved={() => {
                  setEditingItemId(null);
                  router.refresh();
                }}
                orderId={order.id}
              />
            ) : (
              <ReadOnlyItemRow
                canEdit={canEdit}
                disabled={isPending}
                item={item}
                key={item.id}
                onDelete={() => removeItem(item.id)}
                onEdit={() => setEditingItemId(item.id)}
              />
            ),
          )}
        </div>
      </div>

      {canEdit ? (
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
          <div className="grid gap-3 lg:grid-cols-[130px_minmax(150px,1fr)_minmax(170px,1.2fr)_90px_110px_96px]">
            <label>
              <span className="mb-1 block text-xs font-semibold text-slate-500">
                来源
              </span>
              <select
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none"
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
              label="来源 ID"
              onChange={(value) =>
                setDraft((current) => ({ ...current, sourceId: value }))
              }
              placeholder="ULID"
              value={draft.sourceId}
            />
            <SmallInput
              label="项目名称"
              onChange={(value) =>
                setDraft((current) => ({ ...current, itemName: value }))
              }
              value={draft.itemName}
            />
            <SmallInput
              label="数量"
              onChange={(value) =>
                setDraft((current) => ({ ...current, quantity: value }))
              }
              value={draft.quantity}
            />
            <SmallInput
              label="单价"
              onChange={(value) =>
                setDraft((current) => ({ ...current, unitAmount: value }))
              }
              value={draft.unitAmount}
            />
            <button
              className="mt-5 flex h-10 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white disabled:opacity-60"
              disabled={isPending}
              onClick={addItem}
              type="button"
            >
              <Icon className="h-4 w-4" name="plus" />
              添加
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ReadOnlyItemRow({
  item,
  canEdit,
  disabled,
  onEdit,
  onDelete,
}: {
  item: PosOrderItem;
  canEdit: boolean;
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
        {formatOrderMoney(item.unitAmount)}
      </div>
      <div className="text-right font-semibold text-slate-800">
        {formatOrderMoney(item.lineAmount)}
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

function EditableItemRow({
  orderId,
  item,
  disabled,
  onCancel,
  onSaved,
}: {
  orderId: string;
  item: PosOrderItem;
  disabled: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [itemName, setItemName] = useState(item.itemName);
  const [quantity, setQuantity] = useState(item.quantity);
  const [unitAmount, setUnitAmount] = useState(item.unitAmount);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateOrderItemAction(orderId, item.id, {
        itemName: itemName.trim(),
        quantity: quantity.trim(),
        unitAmount: unitAmount.trim(),
        version: item.version,
      });

      if (result.ok) {
        toast.success("订单条目已保存。");
        onSaved();
      } else {
        toast.error(result.message);
      }
    });
  }

  const blocked = disabled || isPending;

  return (
    <div className="grid grid-cols-[minmax(220px,1fr)_100px_120px_120px_120px] items-end border-t border-slate-100 px-5 py-4 text-sm">
      <SmallInput label="项目" onChange={setItemName} value={itemName} />
      <SmallInput label="数量" onChange={setQuantity} value={quantity} />
      <SmallInput label="单价" onChange={setUnitAmount} value={unitAmount} />
      <div className="pb-2 text-right font-semibold text-slate-500">
        {formatOrderMoney(Number(quantity || 0) * Number(unitAmount || 0))}
      </div>
      <div className="flex justify-end gap-1 pb-1">
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40"
          disabled={blocked}
          onClick={onCancel}
          title="取消"
          type="button"
        >
          <Icon className="h-4 w-4" name="x" />
        </button>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white disabled:opacity-40"
          disabled={blocked}
          onClick={save}
          title="保存"
          type="button"
        >
          <Icon className="h-4 w-4" name="save" />
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block pr-2">
      <span className="mb-1 block text-xs font-semibold text-slate-500">
        {label}
      </span>
      <input
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}
