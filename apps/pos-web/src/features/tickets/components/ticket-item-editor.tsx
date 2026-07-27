"use client";

import { posToast as toast } from "@/lib/pos-toast";
import {
  Combobox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@cleanhub/ui";
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
import { coerceTicketItemType, validateTicketItemForm } from "../validators";
import type { TicketItemFormValues } from "../types";
import { TicketItemStatusBadge } from "./ticket-badges";
import type {
  PosCatalogService,
  ServiceTicketItem,
  ServiceTicketItemStatus,
} from "@cleanhub/api-client";

type TicketItemEditorProps = {
  canManage: boolean;
  catalog: PosCatalogService[];
  ticketId: string;
  currency: string;
  items: ServiceTicketItem[];
};

const EMPTY_ITEM_FORM: TicketItemFormValues = {
  serviceId: "",
  pricingUnit: "per_item",
  standardUnitAmount: "0",
  chargedUnitAmount: "0",
  priceTouched: false,
  itemType: "",
  itemCategory: "",
  itemColor: "",
  itemBrand: "",
  itemMaterial: "",
  quantity: "1",
  weight: "",
  bagCount: "1",
  overrideReason: "",
  defectNotes: "",
  specialRequest: "",
  remark: "",
};

/**
 * Full CRUD surface for ticket items on the detail page:
 * - create new items (backend auto-generates `labelCode`)
 * - edit an existing item's fields
 * - transition item status (washing → done → ready_to_pick)
 * - soft-delete an item
 *
 * Every mutation goes through a server action; on success we let the page's
 * `revalidatePath` refresh the data, so this component stays a thin controller.
 */
export function TicketItemEditor({
  canManage,
  catalog,
  ticketId,
  currency,
  items,
}: TicketItemEditorProps) {
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
      serviceId: item.serviceId ?? "",
      pricingUnit: item.pricingUnit,
      standardUnitAmount: item.standardUnitAmount,
      chargedUnitAmount: item.chargedUnitAmount,
      priceTouched: false,
      itemType: item.itemType ?? "",
      itemCategory: item.itemCategory ?? "",
      itemColor: item.itemColor ?? "",
      itemBrand: item.itemBrand ?? "",
      itemMaterial: item.itemMaterial ?? "",
      quantity: String(item.quantity),
      weight: item.weight ?? "",
      bagCount: String(item.bagCount ?? 1),
      overrideReason: "",
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

  const formOpen = creating || editingId !== null;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between border-b border-slate-200 p-5">
        <div>
          <h2 className="font-semibold text-slate-950">工单项目</h2>
          <p className="mt-1 text-sm text-slate-500">
            {items.length} 个项目 · 数量{" "}
            {items.reduce((n, x) => n + x.quantity, 0)}
          </p>
        </div>
        <button
          className="flex h-11 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-100"
          onClick={startCreate}
          type="button"
        >
          <Icon className="h-4 w-4" name="plus" />
          添加项目
        </button>
      </div>

      <div className="divide-y divide-slate-100">
        {items.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            该工单暂无项目，点击「添加项目」开始录入。
          </div>
        ) : null}
        {items.map((item) => (
          <ItemRow
            canManage={canManage}
            currency={currency}
            item={item}
            key={item.id}
            onEdit={() => startEdit(item)}
            ticketId={ticketId}
          />
        ))}
      </div>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            cancel();
          }
        }}
        open={formOpen}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {creating ? "添加工单项目" : "编辑工单项目"}
            </DialogTitle>
          </DialogHeader>
          <ItemForm
            canManage={canManage}
            catalog={catalog}
            currency={currency}
            form={form}
            itemId={editingId ?? undefined}
            onCancel={cancel}
            onChange={setForm}
            onSubmit={creating ? "create" : "update"}
            ticketId={ticketId}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ItemRow({
  canManage,
  currency,
  item,
  onEdit,
  ticketId,
}: {
  canManage: boolean;
  currency: string;
  item: ServiceTicketItem;
  onEdit: () => void;
  ticketId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");

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
    const reason = deleteReason.trim();
    if (!reason) {
      toast.error("请输入删除原因");
      return;
    }
    startTransition(async () => {
      const result = await deleteTicketItemAction(ticketId, item.id, reason);
      if (result.ok) {
        toast.success("项目已删除");
        setDeleteOpen(false);
        setDeleteReason("");
      } else {
        toast.error(result.message);
      }
    });
  }

  const reachable = TICKET_ITEM_STATUS_TRANSITIONS[item.itemStatus] ?? [];
  const details = [
    item.itemCategory,
    item.itemColor,
    item.itemBrand,
    item.itemMaterial,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold text-slate-950">
            {item.itemName}
          </div>
          <div className="mt-1 text-xs text-slate-500">{details || "—"}</div>
          {item.labelCode ? (
            <div className="mt-1 font-mono text-[11px] text-blue-600">
              标签 {item.labelCode}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            aria-label="修改项目"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
            disabled={isPending}
            onClick={onEdit}
            title="修改项目"
            type="button"
          >
            <Icon className="h-4 w-4" name="square-pen" />
          </button>
          {canManage ? (
            <button
              aria-label="删除项目"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              disabled={isPending}
              onClick={() => setDeleteOpen(true)}
              title="删除项目"
              type="button"
            >
              <Icon className="h-4 w-4" name="trash" />
            </button>
          ) : null}
        </div>
      </div>

      {item.defectNotes || item.specialRequest ? (
        <div className="mt-3 space-y-1 rounded-lg border border-amber-100 bg-amber-50/60 p-3">
          {item.defectNotes ? (
            <div className="text-xs text-slate-600">
              <span className="font-semibold text-slate-700">瑕疵：</span>
              {item.defectNotes}
            </div>
          ) : null}
          {item.specialRequest ? (
            <div className="text-xs text-slate-600">
              <span className="font-semibold text-slate-700">要求：</span>
              {item.specialRequest}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">
        <div>
          <div className="text-xs text-slate-400">项目状态</div>
          <div className="mt-1">
            <TicketItemStatusBadge status={item.itemStatus} />
          </div>
          {reachable.length > 0 ? (
            <select
              className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none"
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
        <div>
          <div className="text-xs text-slate-400">
            {item.pricingUnit === "per_kg" ? "重量 / 单价" : "数量 / 单价"}
          </div>
          <div className="mt-1 text-sm font-medium text-slate-700">
            {item.pricingUnit === "per_kg"
              ? `${item.weight ?? "0"} kg${item.bagCount ? ` · ${item.bagCount} 袋` : ""}`
              : `${item.quantity} 件`}{" "}
            × {formatTicketMoney(item.chargedUnitAmount, currency)}
          </div>
          {item.chargedUnitAmount !== item.standardUnitAmount ? (
            <div className="mt-1 text-xs text-amber-700">
              标准价 {formatTicketMoney(item.standardUnitAmount, currency)}
            </div>
          ) : null}
        </div>
        <div>
          <div className="text-xs text-slate-400">项目金额</div>
          <div className="mt-1 font-semibold text-slate-950">
            {formatTicketMoney(item.lineAmount, currency)}
          </div>
        </div>
      </div>
      <Dialog
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setDeleteOpen(false);
            setDeleteReason("");
          }
        }}
        open={deleteOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除项目</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <p className="text-sm text-slate-600">
              删除「{item.itemName}」会写入审计记录。
            </p>
            <Field label="删除原因（必填）" wide>
              <textarea
                className={`${inputClass} min-h-[88px] py-2`}
                disabled={isPending}
                maxLength={500}
                onChange={(event) => setDeleteReason(event.target.value)}
                value={deleteReason}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <button
                className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600"
                disabled={isPending}
                onClick={() => setDeleteOpen(false)}
                type="button"
              >
                取消
              </button>
              <button
                className="h-10 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
                disabled={isPending || !deleteReason.trim()}
                onClick={remove}
                type="button"
              >
                {isPending ? "删除中…" : "确认删除"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function ItemForm({
  canManage,
  catalog,
  currency,
  form,
  onChange,
  onCancel,
  onSubmit,
  ticketId,
  itemId,
}: {
  canManage: boolean;
  catalog: PosCatalogService[];
  currency: string;
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

  function handleNumberInputWheel(event: React.WheelEvent<HTMLInputElement>) {
    event.preventDefault();
    event.currentTarget.blur();
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
      serviceId: form.serviceId,
      itemType: coerceTicketItemType(form.itemType) || undefined,
      itemCategory: form.itemCategory.trim() || undefined,
      itemColor: form.itemColor.trim() || undefined,
      itemBrand: form.itemBrand.trim() || undefined,
      itemMaterial: form.itemMaterial.trim() || undefined,
      quantity:
        form.pricingUnit === "per_item" ? Number(form.quantity) : undefined,
      weight: form.pricingUnit === "per_kg" ? form.weight : undefined,
      bagCount:
        form.pricingUnit === "per_kg" ? Number(form.bagCount) : undefined,
      chargedUnitAmount:
        onSubmit === "create" || form.priceTouched
          ? form.chargedUnitAmount
          : undefined,
      overrideReason:
        form.priceTouched && form.overrideReason.trim()
          ? form.overrideReason.trim()
          : undefined,
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
    <form onSubmit={submit}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Field label="服务项目（必填）" wide>
          <select
            className={inputClass}
            onChange={(event) => {
              const service = catalog.find(
                (entry) => entry.id === event.target.value,
              );
              if (!service) {
                update("serviceId", "");
                return;
              }
              onChange({
                ...form,
                serviceId: service.id,
                pricingUnit: service.pricingUnit,
                standardUnitAmount: service.amount,
                chargedUnitAmount: service.amount,
                priceTouched: true,
                quantity:
                  service.pricingUnit === "per_item"
                    ? form.quantity || "1"
                    : "1",
                weight: service.pricingUnit === "per_kg" ? form.weight : "",
                bagCount:
                  service.pricingUnit === "per_kg" ? form.bagCount || "1" : "1",
                overrideReason: "",
              });
            }}
            value={form.serviceId}
          >
            <option value="">请选择服务</option>
            {catalog.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} ·{" "}
                {service.pricingUnit === "per_kg" ? "按公斤" : "按件"} ·{" "}
                {formatTicketMoney(service.amount, service.currency)}
              </option>
            ))}
          </select>
          {catalog.length === 0 ? (
            <span className="mt-1.5 block text-xs text-amber-700">
              当前业务类型没有可用的服务及有效价格。
            </span>
          ) : null}
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
        {form.pricingUnit === "per_kg" ? (
          <>
            <Field label="重量（kg）">
              <input
                className={inputClass}
                min="0.001"
                onChange={(event) => update("weight", event.target.value)}
                onWheel={handleNumberInputWheel}
                step="0.001"
                type="number"
                value={form.weight}
              />
            </Field>
            <Field label="袋数">
              <input
                className={inputClass}
                min={1}
                onChange={(event) => update("bagCount", event.target.value)}
                onWheel={handleNumberInputWheel}
                step={1}
                type="number"
                value={form.bagCount}
              />
            </Field>
          </>
        ) : (
          <Field label="数量">
            <input
              className={inputClass}
              min={1}
              onChange={(event) => update("quantity", event.target.value)}
              onWheel={handleNumberInputWheel}
              step={1}
              type="number"
              value={form.quantity}
            />
          </Field>
        )}
        <Field label={canManage ? "收费单价" : "标准单价"}>
          <input
            className={inputClass}
            disabled={!canManage}
            min={0}
            onChange={(event) =>
              onChange({
                ...form,
                chargedUnitAmount: event.target.value,
                priceTouched: true,
              })
            }
            onWheel={handleNumberInputWheel}
            step="0.01"
            type="number"
            value={form.chargedUnitAmount}
          />
          {canManage && form.chargedUnitAmount !== form.standardUnitAmount ? (
            <span className="mt-1.5 block text-xs text-amber-700">
              标准价 {formatTicketMoney(form.standardUnitAmount, currency)}
            </span>
          ) : null}
        </Field>
        <Field label="行金额（自动计算）">
          <input
            className={inputClass}
            disabled
            value={formatTicketMoney(
              (form.pricingUnit === "per_kg"
                ? Number(form.weight) || 0
                : Number(form.quantity) || 0) *
                (Number(form.chargedUnitAmount) || 0),
              currency,
            )}
          />
        </Field>
        {canManage &&
        form.priceTouched &&
        Number(form.chargedUnitAmount).toFixed(2) !==
          Number(form.standardUnitAmount).toFixed(2) ? (
          <Field label="改价原因（必填）" wide>
            <textarea
              className={`${inputClass} min-h-[72px] py-2`}
              maxLength={500}
              onChange={(event) => update("overrideReason", event.target.value)}
              value={form.overrideReason}
            />
          </Field>
        ) : null}
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
      <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button
          className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          disabled={isPending}
          onClick={onCancel}
          type="button"
        >
          取消
        </button>
        <button
          className="flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
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
