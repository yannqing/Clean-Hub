"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type {
  PosCatalogService,
  PosOrderDetail,
  PosOrderItem,
} from "@cleanhub/api-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cleanhub/ui";

import { Icon } from "@/components/app-shell";
import { posToast as toast } from "@/lib/pos-toast";

import {
  createOrderItemAction,
  deleteOrderItemAction,
  updateOrderItemAction,
} from "../actions";
import { formatOrderMoney } from "../constants";

type ItemDraft = {
  serviceId: string;
  pricingUnit: "per_item" | "per_kg";
  standardUnitAmount: string;
  chargedUnitAmount: string;
  priceTouched: boolean;
  quantity: string;
  weight: string;
  bagCount: string;
  itemColor: string;
  defectNotes: string;
  specialRequest: string;
  itemIdentifier: string;
  overrideReason: string;
};

type ItemDialogMode = { type: "create" } | { type: "edit"; item: PosOrderItem };

const EMPTY_DRAFT: ItemDraft = {
  serviceId: "",
  pricingUnit: "per_item",
  standardUnitAmount: "0",
  chargedUnitAmount: "0",
  priceTouched: false,
  quantity: "1",
  weight: "",
  bagCount: "1",
  itemColor: "",
  defectNotes: "",
  specialRequest: "",
  itemIdentifier: "",
  overrideReason: "",
};

export function OrderItemsManager({
  canManageSensitiveOperations,
  catalog,
  order,
}: {
  canManageSensitiveOperations: boolean;
  catalog: PosCatalogService[];
  order: PosOrderDetail;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [itemDialog, setItemDialog] = useState<ItemDialogMode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PosOrderItem | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const canEdit =
    Number(order.paidAmount) === 0 &&
    order.status !== "paid" &&
    order.status !== "delivered" &&
    order.status !== "cancelled";
  const canDelete = canEdit && canManageSensitiveOperations;

  function removeItem(itemId: string, reason: string) {
    startTransition(async () => {
      const result = await deleteOrderItemAction(order.id, itemId, { reason });
      if (result.ok) {
        toast.success("订单条目已删除。");
        setDeleteTarget(null);
        setDeleteReason("");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="font-semibold text-slate-950">订单条目</h2>
          <p className="mt-1 text-xs text-slate-500">
            条目价格按目录保存快照，称重服务按实际重量计算。
          </p>
        </div>
        {canEdit ? (
          <button
            className="flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            disabled={isPending || catalog.length === 0}
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

      {catalog.length === 0 && canEdit ? (
        <div className="border-b border-amber-100 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          当前门店没有可用的服务及有效价格。
        </div>
      ) : null}

      <div className="divide-y divide-slate-100 min-[1400px]:hidden">
        {order.items.map((item) => (
          <ReadOnlyItemCard
            canDelete={canDelete}
            canEdit={canEdit}
            currency={order.currency}
            disabled={isPending}
            item={item}
            key={item.id}
            onDelete={() => setDeleteTarget(item)}
            onEdit={() => setItemDialog({ type: "edit", item })}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto min-[1400px]:block">
        <div className="min-w-[920px]">
          <div className="grid grid-cols-[minmax(260px,1fr)_150px_150px_120px_110px] bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase text-slate-400">
            <div>项目</div>
            <div>计量</div>
            <div>单价</div>
            <div className="text-right">小计</div>
            <div className="text-right">操作</div>
          </div>
          {order.items.map((item) => (
            <ReadOnlyItemRow
              canDelete={canDelete}
              canEdit={canEdit}
              currency={order.currency}
              disabled={isPending}
              item={item}
              key={item.id}
              onDelete={() => setDeleteTarget(item)}
              onEdit={() => setItemDialog({ type: "edit", item })}
            />
          ))}
        </div>
      </div>

      {itemDialog ? (
        <OrderItemDialog
          canOverridePrice={canManageSensitiveOperations}
          catalog={catalog}
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

      <Dialog
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setDeleteTarget(null);
            setDeleteReason("");
          }
        }}
        open={deleteTarget !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除订单条目</DialogTitle>
            <DialogDescription>
              删除「{deleteTarget?.itemName}」需要 Owner 或 Manager
              权限，原因会写入审计记录。
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            操作原因
            <textarea
              className="min-h-24 rounded-lg border border-slate-200 px-3 py-2 font-normal outline-none focus:border-blue-300"
              disabled={isPending}
              maxLength={500}
              onChange={(event) => setDeleteReason(event.target.value)}
              value={deleteReason}
            />
          </label>
          <DialogFooter>
            <button
              className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700"
              disabled={isPending}
              onClick={() => {
                setDeleteTarget(null);
                setDeleteReason("");
              }}
              type="button"
            >
              返回
            </button>
            <button
              className="h-10 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              disabled={isPending || !deleteReason.trim()}
              onClick={() => {
                if (deleteTarget)
                  removeItem(deleteTarget.id, deleteReason.trim());
              }}
              type="button"
            >
              {isPending ? "删除中…" : "确认删除"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ReadOnlyItemCard({
  item,
  canEdit,
  canDelete,
  currency,
  disabled,
  onEdit,
  onDelete,
}: {
  item: PosOrderItem;
  canEdit: boolean;
  canDelete: boolean;
  currency: string;
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="p-4 sm:p-5">
      <ItemHeading item={item} />
      <dl className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3">
        <OrderItemCardDetail label="计量" value={formatMeasurement(item)} />
        <OrderItemCardDetail
          label="收费单价"
          value={formatOrderMoney(item.chargedUnitAmount, currency)}
        />
        <OrderItemCardDetail
          label="小计"
          value={formatOrderMoney(item.lineAmount, currency)}
        />
      </dl>
      <IntakeDetails item={item} />
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
        {canDelete ? (
          <button
            className="flex h-11 items-center gap-2 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-600 disabled:opacity-40"
            disabled={disabled}
            onClick={onDelete}
            type="button"
          >
            <Icon className="h-4 w-4" name="trash" />
            删除
          </button>
        ) : null}
      </div>
    </article>
  );
}

function OrderItemDialog({
  orderId,
  mode,
  catalog,
  canOverridePrice,
  currency,
  disabled,
  onClose,
  onSaved,
}: {
  orderId: string;
  mode: ItemDialogMode;
  catalog: PosCatalogService[];
  canOverridePrice: boolean;
  currency: string;
  disabled: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editingItem = mode.type === "edit" ? mode.item : null;
  const [draft, setDraft] = useState<ItemDraft>(() => ({
    ...EMPTY_DRAFT,
    serviceId: editingItem?.serviceId ?? "",
    pricingUnit: editingItem?.pricingUnit ?? "per_item",
    standardUnitAmount: editingItem?.standardUnitAmount ?? "0",
    chargedUnitAmount: editingItem?.chargedUnitAmount ?? "0",
    quantity: editingItem?.quantity ?? "1",
    weight: editingItem?.weight ?? "",
    bagCount: String(editingItem?.bagCount ?? 1),
    itemColor: editingItem?.itemColor ?? "",
    defectNotes: editingItem?.defectNotes ?? "",
    specialRequest: editingItem?.specialRequest ?? "",
    itemIdentifier: editingItem?.itemIdentifier ?? "",
  }));
  const [isPending, startTransition] = useTransition();

  const blocked = disabled || isPending;
  const priceOverridden = !moneyEquals(
    draft.chargedUnitAmount,
    draft.standardUnitAmount,
  );
  const needsOverrideReason =
    canOverridePrice && draft.priceTouched && priceOverridden;

  function update<K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function selectService(serviceId: string) {
    const service = catalog.find((entry) => entry.id === serviceId);
    if (!service) {
      update("serviceId", "");
      return;
    }
    setDraft((current) => ({
      ...current,
      serviceId: service.id,
      pricingUnit: service.pricingUnit,
      standardUnitAmount: service.amount,
      chargedUnitAmount: service.amount,
      priceTouched: true,
      quantity:
        service.pricingUnit === "per_item" ? current.quantity || "1" : "1",
      weight: service.pricingUnit === "per_kg" ? current.weight : "",
      bagCount:
        service.pricingUnit === "per_kg" ? current.bagCount || "1" : "1",
      overrideReason: "",
    }));
  }

  function save() {
    if (!draft.serviceId) {
      toast.error("请选择服务项目。");
      return;
    }
    if (
      draft.pricingUnit === "per_item" &&
      (!Number.isInteger(Number(draft.quantity)) || Number(draft.quantity) < 1)
    ) {
      toast.error("数量必须是大于等于 1 的整数。");
      return;
    }
    if (
      draft.pricingUnit === "per_kg" &&
      (!draft.weight || Number(draft.weight) <= 0)
    ) {
      toast.error("请输入大于 0 的重量。");
      return;
    }
    if (
      draft.pricingUnit === "per_kg" &&
      (!Number.isInteger(Number(draft.bagCount)) || Number(draft.bagCount) < 1)
    ) {
      toast.error("袋数必须是大于等于 1 的整数。");
      return;
    }
    if (needsOverrideReason && !draft.overrideReason.trim()) {
      toast.error("覆盖标准价时必须填写原因。");
      return;
    }

    const common = {
      serviceId: draft.serviceId,
      quantity:
        draft.pricingUnit === "per_item" ? draft.quantity.trim() : undefined,
      weight: draft.pricingUnit === "per_kg" ? draft.weight.trim() : undefined,
      bagCount:
        draft.pricingUnit === "per_kg" ? Number(draft.bagCount) : undefined,
      chargedUnitAmount:
        !editingItem || draft.priceTouched
          ? draft.chargedUnitAmount.trim()
          : undefined,
      overrideReason:
        draft.priceTouched && draft.overrideReason.trim()
          ? draft.overrideReason.trim()
          : undefined,
      itemColor: draft.itemColor.trim() || undefined,
      defectNotes: draft.defectNotes.trim() || undefined,
      specialRequest: draft.specialRequest.trim() || undefined,
      itemIdentifier: draft.itemIdentifier.trim() || undefined,
    };

    startTransition(async () => {
      const result = editingItem
        ? await updateOrderItemAction(orderId, editingItem.id, {
            ...common,
            itemColor: draft.itemColor.trim() || null,
            defectNotes: draft.defectNotes.trim() || null,
            specialRequest: draft.specialRequest.trim() || null,
            itemIdentifier: draft.itemIdentifier.trim() || null,
            version: editingItem.version,
          })
        : await createOrderItemAction(orderId, common);

      if (result.ok) {
        toast.success(editingItem ? "订单条目已保存。" : "订单条目已添加。");
        onSaved();
      } else {
        toast.error(result.message);
      }
    });
  }

  const units =
    draft.pricingUnit === "per_kg"
      ? Number(draft.weight) || 0
      : Number(draft.quantity) || 0;

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !blocked) onClose();
      }}
      open
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-2xl">
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

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
              服务项目
            </span>
            <select
              className={inputClass}
              disabled={blocked}
              onChange={(event) => selectService(event.target.value)}
              value={draft.serviceId}
            >
              <option value="">请选择服务</option>
              {catalog.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} ·{" "}
                  {service.pricingUnit === "per_kg" ? "按公斤" : "按件"} ·{" "}
                  {formatOrderMoney(service.amount, service.currency)}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            {draft.pricingUnit === "per_kg" ? (
              <>
                <SmallInput
                  disabled={blocked}
                  label="重量（kg）"
                  onChange={(value) => update("weight", value)}
                  type="number"
                  value={draft.weight}
                />
                <SmallInput
                  disabled={blocked}
                  label="袋数"
                  onChange={(value) => update("bagCount", value)}
                  type="number"
                  value={draft.bagCount}
                />
              </>
            ) : (
              <SmallInput
                disabled={blocked}
                label="数量"
                onChange={(value) => update("quantity", value)}
                type="number"
                value={draft.quantity}
              />
            )}
            <SmallInput
              disabled={blocked || !canOverridePrice}
              label={canOverridePrice ? "收费单价" : "标准单价"}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  chargedUnitAmount: value,
                  priceTouched: true,
                }))
              }
              type="number"
              value={draft.chargedUnitAmount}
            />
          </div>

          <div className="rounded-lg bg-blue-50 px-4 py-3">
            <div className="text-xs font-semibold text-blue-600">计算小计</div>
            <div className="mt-1 text-lg font-semibold text-blue-950">
              {formatOrderMoney(
                units * Number(draft.chargedUnitAmount || 0),
                currency,
              )}
            </div>
            {priceOverridden ? (
              <div className="mt-1 text-xs text-amber-700">
                标准价 {formatOrderMoney(draft.standardUnitAmount, currency)}
              </div>
            ) : null}
          </div>

          {needsOverrideReason ? (
            <TextAreaField
              disabled={blocked}
              label="改价原因（必填）"
              maxLength={500}
              onChange={(value) => update("overrideReason", value)}
              value={draft.overrideReason}
            />
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <SmallInput
              disabled={blocked}
              label="颜色"
              onChange={(value) => update("itemColor", value)}
              value={draft.itemColor}
            />
            <SmallInput
              disabled={blocked}
              label="物品 / 袋标识"
              onChange={(value) => update("itemIdentifier", value)}
              value={draft.itemIdentifier}
            />
          </div>
          <TextAreaField
            disabled={blocked}
            label="瑕疵"
            onChange={(value) => update("defectNotes", value)}
            value={draft.defectNotes}
          />
          <TextAreaField
            disabled={blocked}
            label="特殊要求"
            onChange={(value) => update("specialRequest", value)}
            value={draft.specialRequest}
          />

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

function ReadOnlyItemRow({
  item,
  canEdit,
  canDelete,
  currency,
  disabled,
  onEdit,
  onDelete,
}: {
  item: PosOrderItem;
  canEdit: boolean;
  canDelete: boolean;
  currency: string;
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(260px,1fr)_150px_150px_120px_110px] items-center border-t border-slate-100 px-5 py-4 text-sm">
      <div className="min-w-0">
        <ItemHeading item={item} />
        <IntakeDetails item={item} />
      </div>
      <div className="font-medium text-slate-600">
        {formatMeasurement(item)}
      </div>
      <div className="font-medium text-slate-600">
        {formatOrderMoney(item.chargedUnitAmount, currency)}
        {item.chargedUnitAmount !== item.standardUnitAmount ? (
          <div className="text-xs text-amber-700">
            标准 {formatOrderMoney(item.standardUnitAmount, currency)}
          </div>
        ) : null}
      </div>
      <div className="text-right font-semibold text-slate-800">
        {formatOrderMoney(item.lineAmount, currency)}
      </div>
      <div className="flex justify-end gap-1">
        <button
          aria-label="编辑条目"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-40"
          disabled={!canEdit || disabled}
          onClick={onEdit}
          title="编辑条目"
          type="button"
        >
          <Icon className="h-4 w-4" name="square-pen" />
        </button>
        {canDelete ? (
          <button
            aria-label="删除条目"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
            disabled={disabled}
            onClick={onDelete}
            title="删除条目"
            type="button"
          >
            <Icon className="h-4 w-4" name="trash" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ItemHeading({ item }: { item: PosOrderItem }) {
  return (
    <div>
      <div className="truncate font-semibold text-slate-900">
        {item.itemName}
      </div>
      {item.itemIdentifier ? (
        <div className="mt-1 font-mono text-[11px] text-blue-600">
          标识 {item.itemIdentifier}
        </div>
      ) : null}
    </div>
  );
}

function IntakeDetails({ item }: { item: PosOrderItem }) {
  const details = [
    item.itemColor ? `颜色：${item.itemColor}` : null,
    item.defectNotes ? `瑕疵：${item.defectNotes}` : null,
    item.specialRequest ? `要求：${item.specialRequest}` : null,
  ].filter(Boolean);
  return details.length > 0 ? (
    <div className="mt-2 text-xs leading-5 text-slate-500">
      {details.join(" · ")}
    </div>
  ) : null;
}

function formatMeasurement(item: PosOrderItem): string {
  return item.pricingUnit === "per_kg"
    ? `${item.weight ?? "0"} kg${item.bagCount ? ` · ${item.bagCount} 袋` : ""}`
    : `${item.quantity} 件`;
}

function moneyEquals(left: string, right: string): boolean {
  return Number(left).toFixed(2) === Number(right).toFixed(2);
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

const inputClass =
  "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-500";

function SmallInput({
  label,
  value,
  onChange,
  disabled,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  type?: "text" | "number";
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-500">
        {label}
      </span>
      <input
        className={inputClass}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        step={type === "number" ? "0.001" : undefined}
        type={type}
        value={value}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  disabled,
  maxLength = 2000,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      {label}
      <textarea
        className="min-h-20 rounded-lg border border-slate-200 px-3 py-2 font-normal outline-none focus:border-blue-300 disabled:bg-slate-50"
        disabled={disabled}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}
