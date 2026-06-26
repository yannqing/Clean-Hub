"use client";

import { toast, Combobox } from "@cleanhub/ui";
import { useState, useTransition } from "react";

import { Icon } from "@/components/app-shell";

import {
  changeTicketItemStatusAction,
  createTicketItemAction,
  deleteTicketItemAction,
  updateTicketItemAction,
} from "../actions";
import {
  ITEM_BRAND_OPTIONS,
  ITEM_COLOR_OPTIONS,
  ITEM_MATERIAL_OPTIONS,
  TICKET_ITEM_STATUS_LABELS,
  TICKET_ITEM_STATUS_TRANSITIONS,
  TICKET_ITEM_TYPE_OPTIONS,
  formatTicketMoney,
} from "../constants";
import {
  coerceTicketItemType,
  validateTicketItemForm,
} from "../validators";
import type { TicketItemFormValues } from "../types";
import { TicketItemStatusBadge } from "./ticket-badges";
import type {
  ServiceTicketItem,
  ServiceTicketItemStatus,
} from "@cleanhub/api-client";

type TicketItemEditorProps = {
  ticketId: string;
  items: ServiceTicketItem[];
};

const EMPTY_ITEM_FORM: TicketItemFormValues = {
  itemName: "",
  itemType: "",
  itemCategory: "",
  itemColor: "",
  itemBrand: "",
  itemMaterial: "",
  quantity: "1",
  unitAmount: "0",
  defectNotes: "",
  specialRequest: "",
  remark: "",
};

/**
 * Full CRUD surface for ticket items on the detail page:
 * - create new items (backend auto-generates `labelCode`)
 * - inline-edit an existing item's fields
 * - transition item status (washing → done → ready_to_pick)
 * - soft-delete an item
 *
 * Every mutation goes through a server action; on success we let the page's
 * `revalidatePath` refresh the data, so this component stays a thin controller.
 */
export function TicketItemEditor({ ticketId, items }: TicketItemEditorProps) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TicketItemFormValues>(EMPTY_ITEM_FORM);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_ITEM_FORM);
    setCreating(true);
  }

  function startEdit(item: ServiceTicketItem) {
    setCreating(false);
    setEditingId(item.id);
    setForm({
      itemName: item.itemName,
      itemType: item.itemType ?? "",
      itemCategory: item.itemCategory ?? "",
      itemColor: item.itemColor ?? "",
      itemBrand: item.itemBrand ?? "",
      itemMaterial: item.itemMaterial ?? "",
      quantity: String(item.quantity),
      unitAmount: item.unitAmount,
      defectNotes: item.defectNotes ?? "",
      specialRequest: item.specialRequest ?? "",
      remark: item.remark ?? "",
    });
  }

  function cancel() {
    setCreating(false);
    setEditingId(null);
    setForm(EMPTY_ITEM_FORM);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between border-b border-slate-200 p-5">
        <div>
          <h2 className="font-semibold text-slate-950">工单项目</h2>
          <p className="mt-1 text-sm text-slate-500">
            {items.length} 个项目 · 数量 {items.reduce((n, x) => n + x.quantity, 0)}
          </p>
        </div>
        <button
          className="flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
          onClick={startCreate}
          type="button"
        >
          <Icon className="h-4 w-4" name="plus" />
          添加项目
        </button>
      </div>

      {creating ? (
        <ItemForm
          form={form}
          onCancel={cancel}
          onChange={setForm}
          onSubmit="create"
          ticketId={ticketId}
        />
      ) : null}

      <div className="divide-y divide-slate-100">
        {items.length === 0 && !creating ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            该工单暂无项目，点击「添加项目」开始录入。
          </div>
        ) : null}
        {items.map((item) =>
          editingId === item.id ? (
            <ItemForm
              form={form}
              itemId={item.id}
              key={item.id}
              onCancel={cancel}
              onChange={setForm}
              onSubmit="update"
              ticketId={ticketId}
            />
          ) : (
            <ItemRow
              item={item}
              key={item.id}
              onEdit={() => startEdit(item)}
              ticketId={ticketId}
            />
          ),
        )}
      </div>
    </section>
  );
}

function ItemRow({
  item,
  onEdit,
  ticketId,
}: {
  item: ServiceTicketItem;
  onEdit: () => void;
  ticketId: string;
}) {
  const [isPending, startTransition] = useTransition();

  function changeStatus(next: ServiceTicketItemStatus) {
    startTransition(async () => {
      const result = await changeTicketItemStatusAction(ticketId, item.id, {
        to: next,
      });
      if (result.ok) {
        toast.success(`项目状态已更新为「${TICKET_ITEM_STATUS_LABELS[next]}」`);
      } else {
        toast.error(result.message);
      }
    });
  }

  function remove() {
    if (!window.confirm(`确认删除项目「${item.itemName}」？`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteTicketItemAction(ticketId, item.id);
      if (result.ok) {
        toast.success("项目已删除");
      } else {
        toast.error(result.message);
      }
    });
  }

  const reachable = TICKET_ITEM_STATUS_TRANSITIONS[item.itemStatus] ?? [];
  const details = [item.itemCategory, item.itemColor, item.itemBrand, item.itemMaterial]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="grid grid-cols-[minmax(0,1fr)_120px_120px_120px] items-start gap-3 p-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-950">{item.itemName}</span>
        </div>
        <div className="mt-1 truncate text-xs text-slate-500">
          {details || "—"}
        </div>
        {item.labelCode ? (
          <div className="mt-1 font-mono text-[11px] text-blue-600">
            标签 {item.labelCode}
          </div>
        ) : null}
        {item.defectNotes ? (
          <div className="mt-1 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">瑕疵：</span>
            {item.defectNotes}
          </div>
        ) : null}
        {item.specialRequest ? (
          <div className="mt-1 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">要求：</span>
            {item.specialRequest}
          </div>
        ) : null}
      </div>
      <div>
        <TicketItemStatusBadge status={item.itemStatus} />
        {reachable.length > 0 ? (
          <select
            className="mt-2 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none"
            disabled={isPending}
            onChange={(event) =>
              changeStatus(event.target.value as ServiceTicketItemStatus)
            }
            value=""
          >
            <option value="">流转状态…</option>
            {reachable.map((status) => (
              <option key={status} value={status}>
                → {TICKET_ITEM_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="text-right">
        <div className="font-semibold text-slate-950">
          {formatTicketMoney(item.lineAmount)}
        </div>
        <div className="mt-1 text-[11px] text-slate-400">
          {item.quantity} × {formatTicketMoney(item.unitAmount)}
        </div>
      </div>
      <div className="flex justify-end gap-1">
        <button
          aria-label="修改项目"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-700"
          disabled={isPending}
          onClick={onEdit}
          title="修改项目"
          type="button"
        >
          <Icon className="h-4 w-4" name="square-pen" />
        </button>
        <button
          aria-label="删除项目"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"
          disabled={isPending}
          onClick={remove}
          title="删除项目"
          type="button"
        >
          <Icon className="h-4 w-4" name="trash" />
        </button>
      </div>
    </article>
  );
}

function ItemForm({
  form,
  onChange,
  onCancel,
  onSubmit,
  ticketId,
  itemId,
}: {
  form: TicketItemFormValues;
  onChange: (next: TicketItemFormValues) => void;
  onCancel: () => void;
  onSubmit: "create" | "update";
  ticketId: string;
  itemId?: string;
}) {
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof TicketItemFormValues>(
    key: K,
    value: TicketItemFormValues[K],
  ) {
    onChange({ ...form, [key]: value });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const errors = validateTicketItemForm(form);
    if (errors) {
      const first = Object.values(errors)[0];
      if (first) {
        toast.error(first);
      }
      return;
    }

    const payload = {
      itemName: form.itemName.trim(),
      itemType: coerceTicketItemType(form.itemType) || undefined,
      itemCategory: form.itemCategory.trim() || undefined,
      itemColor: form.itemColor.trim() || undefined,
      itemBrand: form.itemBrand.trim() || undefined,
      itemMaterial: form.itemMaterial.trim() || undefined,
      quantity: Number(form.quantity),
      unitAmount: form.unitAmount,
      defectNotes: form.defectNotes.trim() || undefined,
      specialRequest: form.specialRequest.trim() || undefined,
      remark: form.remark.trim() || undefined,
    };

    startTransition(async () => {
      const result =
        onSubmit === "create"
          ? await createTicketItemAction(ticketId, payload)
          : await updateTicketItemAction(ticketId, itemId!, payload);
      if (result.ok) {
        toast.success(onSubmit === "create" ? "项目已添加" : "项目已更新");
        onCancel();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <form
      className="border-t border-slate-100 bg-slate-50/70 p-5"
      onSubmit={submit}
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Field label="物品名称（必填）">
          <input
            className={inputClass}
            onChange={(event) => update("itemName", event.target.value)}
            value={form.itemName}
          />
        </Field>
        <Field label="物品类型">
          <select
            className={inputClass}
            onChange={(event) =>
              update("itemType", coerceTicketItemType(event.target.value))
            }
            value={form.itemType}
          >
            <option value="">（未指定）</option>
            {TICKET_ITEM_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="分类">
          <input
            className={inputClass}
            onChange={(event) => update("itemCategory", event.target.value)}
            value={form.itemCategory}
          />
        </Field>
        <Field label="颜色">
          <Combobox
            options={ITEM_COLOR_OPTIONS}
            value={form.itemColor}
            onValueChange={(v) => update("itemColor", v)}
            placeholder="选择颜色…"
            searchPlaceholder="搜索颜色…"
            emptyText="无匹配颜色，按回车自定义"
          />
        </Field>
        <Field label="品牌">
          <Combobox
            options={ITEM_BRAND_OPTIONS}
            value={form.itemBrand}
            onValueChange={(v) => update("itemBrand", v)}
            placeholder="选择品牌…"
            searchPlaceholder="搜索品牌…"
            emptyText="无匹配品牌，按回车自定义"
          />
        </Field>
        <Field label="材质">
          <Combobox
            options={ITEM_MATERIAL_OPTIONS}
            value={form.itemMaterial}
            onValueChange={(v) => update("itemMaterial", v)}
            placeholder="选择材质…"
            searchPlaceholder="搜索材质…"
            emptyText="无匹配材质，按回车自定义"
          />
        </Field>
        <Field label="数量">
          <input
            className={inputClass}
            min={1}
            onChange={(event) => update("quantity", event.target.value)}
            type="number"
            value={form.quantity}
          />
        </Field>
        <Field label="单价">
          <input
            className={inputClass}
            min={0}
            onChange={(event) => update("unitAmount", event.target.value)}
            type="number"
            value={form.unitAmount}
          />
        </Field>
        <Field label="行金额（自动计算）">
          <input
            className={inputClass}
            disabled
            value={formatTicketMoney(
              (Number(form.quantity) || 0) * (Number(form.unitAmount) || 0),
            )}
          />
        </Field>
        <Field label="瑕疵" wide>
          <textarea
            className={`${inputClass} min-h-[72px]`}
            onChange={(event) => update("defectNotes", event.target.value)}
            value={form.defectNotes}
          />
        </Field>
        <Field label="特殊要求" wide>
          <textarea
            className={`${inputClass} min-h-[72px]`}
            onChange={(event) => update("specialRequest", event.target.value)}
            value={form.specialRequest}
          />
        </Field>
        <Field label="项目备注" wide>
          <textarea
            className={`${inputClass} min-h-[72px]`}
            onChange={(event) => update("remark", event.target.value)}
            value={form.remark}
          />
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          disabled={isPending}
          onClick={onCancel}
          type="button"
        >
          取消
        </button>
        <button
          className="flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          disabled={isPending}
          type="submit"
        >
          <Icon className="h-4 w-4" name="save" />
          {isPending ? "保存中…" : "保存"}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 disabled:bg-slate-100";

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={wide ? "col-span-2 lg:col-span-3" : ""}>
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}
