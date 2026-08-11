"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type {
  PosCatalogProduct,
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
  itemKind: "service" | "product";
  serviceId: string;
  productSkuId: string;
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
  itemKind: "product",
  serviceId: "",
  productSkuId: "",
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
  products,
  order,
}: {
  canManageSensitiveOperations: boolean;
  catalog: PosCatalogService[];
  products: PosCatalogProduct[];
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
    <section className="overflow-hidden border-y bg-background">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="font-semibold text-foreground">订单条目</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            条目价格按目录保存快照，称重服务按实际重量计算。
          </p>
        </div>
        {canEdit ? (
          <button
            className="flex h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-60"
            disabled={isPending || (catalog.length === 0 && products.length === 0)}
            onClick={() => setItemDialog({ type: "create" })}
            type="button"
          >
            <Icon className="h-4 w-4" name="plus" />
            新增条目
          </button>
        ) : (
          <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            当前不可编辑
          </span>
        )}
      </div>

      {catalog.length === 0 && products.length === 0 && canEdit ? (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
          当前门店没有可用的服务或商品及有效价格。
        </div>
      ) : null}

      <div className="divide-y min-[1400px]:hidden">
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
          <div className="grid grid-cols-[minmax(260px,1fr)_150px_150px_120px_110px] bg-muted/50 px-5 py-3 text-[11px] font-semibold uppercase text-muted-foreground">
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
          products={products}
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
          <label className="grid gap-2 text-sm font-medium text-foreground">
            操作原因
            <textarea
              className="min-h-24 rounded-md border bg-background px-3 py-2 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={isPending}
              maxLength={500}
              onChange={(event) => setDeleteReason(event.target.value)}
              value={deleteReason}
            />
          </label>
          <DialogFooter>
            <button
              className="h-11 rounded-md border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
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
              className="h-11 rounded-md bg-destructive px-4 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
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
      <dl className="mt-4 grid grid-cols-3 gap-3 rounded-md bg-muted/40 p-3">
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
          className="flex h-11 items-center gap-2 rounded-md border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
          disabled={!canEdit || disabled}
          onClick={onEdit}
          type="button"
        >
          <Icon className="h-4 w-4" name="square-pen" />
          编辑
        </button>
        {canDelete ? (
          <button
            className="flex h-11 items-center gap-2 rounded-md border border-destructive/30 px-4 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-40"
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
  products,
  canOverridePrice,
  currency,
  disabled,
  onClose,
  onSaved,
}: {
  orderId: string;
  mode: ItemDialogMode;
  catalog: PosCatalogService[];
  products: PosCatalogProduct[];
  canOverridePrice: boolean;
  currency: string;
  disabled: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editingItem = mode.type === "edit" ? mode.item : null;
  const [draft, setDraft] = useState<ItemDraft>(() => ({
    ...EMPTY_DRAFT,
    itemKind: editingItem?.itemKind === "product" ? "product" : "service",
    serviceId: editingItem?.serviceId ?? "",
    productSkuId: editingItem?.productSkuId ?? "",
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

  function selectCatalogItem(value: string) {
    const [kind, id] = value.split(":", 2);
    if (kind === "product") {
      const product = products.find((entry) => entry.productSkuId === id);
      if (!product) {
        setDraft((current) => ({
          ...current,
          serviceId: "",
          productSkuId: "",
        }));
        return;
      }
      setDraft((current) => ({
        ...current,
        itemKind: "product",
        serviceId: "",
        productSkuId: product.productSkuId,
        pricingUnit: "per_item",
        standardUnitAmount: product.amount,
        chargedUnitAmount: product.amount,
        priceTouched: true,
        quantity: current.quantity || "1",
        weight: "",
        bagCount: "1",
        itemColor: "",
        defectNotes: "",
        specialRequest: "",
        itemIdentifier: product.barcode ?? product.sku,
        overrideReason: "",
      }));
      return;
    }
    const service = catalog.find((entry) => entry.id === id);
    if (!service) {
      setDraft((current) => ({
        ...current,
        serviceId: "",
        productSkuId: "",
      }));
      return;
    }
    setDraft((current) => ({
      ...current,
      itemKind: "service",
      serviceId: service.id,
      productSkuId: "",
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
    if (
      (draft.itemKind === "service" && !draft.serviceId) ||
      (draft.itemKind === "product" && !draft.productSkuId)
    ) {
      toast.error("请选择服务或商品。");
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
    const catalogReference =
      draft.itemKind === "product"
        ? { productSkuId: draft.productSkuId }
        : { serviceId: draft.serviceId };

    startTransition(async () => {
      const result = editingItem
        ? await updateOrderItemAction(orderId, editingItem.id, {
            ...common,
            ...catalogReference,
            itemColor: draft.itemColor.trim() || null,
            defectNotes: draft.defectNotes.trim() || null,
            specialRequest: draft.specialRequest.trim() || null,
            itemIdentifier: draft.itemIdentifier.trim() || null,
            version: editingItem.version,
          })
        : await createOrderItemAction(orderId, {
            ...common,
            ...catalogReference,
          });

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
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              服务或商品
            </span>
            <select
              className={inputClass}
              disabled={blocked}
              onChange={(event) => selectCatalogItem(event.target.value)}
              value={
                draft.itemKind === "product" && draft.productSkuId
                  ? `product:${draft.productSkuId}`
                  : draft.serviceId
                    ? `service:${draft.serviceId}`
                    : ""
              }
            >
              <option value="">请选择服务或商品</option>
              {products.length > 0 ? (
                <optgroup label="商品">
                  {products.map((product) => {
                    const outOfStock =
                      product.trackInventory &&
                      !product.allowNegativeStock &&
                      Number(product.availableQuantity ?? 0) <= 0;
                    return (
                      <option
                        disabled={outOfStock}
                        key={product.productSkuId}
                        value={`product:${product.productSkuId}`}
                      >
                        {product.name}
                        {product.variantName ? ` · ${product.variantName}` : ""}
                        {" · "}
                        {formatOrderMoney(product.amount, product.currency)}
                        {product.trackInventory
                          ? ` · 库存 ${Number(product.availableQuantity ?? 0)}`
                          : ""}
                      </option>
                    );
                  })}
                </optgroup>
              ) : null}
              {catalog.length > 0 ? (
                <optgroup label="服务">
              {catalog.map((service) => (
                <option key={service.id} value={`service:${service.id}`}>
                  {service.name} ·{" "}
                  {service.pricingUnit === "per_kg" ? "按公斤" : "按件"} ·{" "}
                  {formatOrderMoney(service.amount, service.currency)}
                </option>
              ))}
                </optgroup>
              ) : null}
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

          <div className="rounded-md bg-muted/50 px-4 py-3">
            <div className="text-xs font-semibold text-muted-foreground">
              计算小计
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">
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

          {draft.itemKind === "service" ? (
            <>
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
            </>
          ) : null}

          <DialogFooter>
            <button
              className="h-11 rounded-md border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-40"
              disabled={blocked}
              onClick={onClose}
              type="button"
            >
              取消
            </button>
            <button
              className="flex h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-40"
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
    <div className="grid grid-cols-[minmax(260px,1fr)_150px_150px_120px_110px] items-center border-t px-5 py-4 text-sm">
      <div className="min-w-0">
        <ItemHeading item={item} />
        <IntakeDetails item={item} />
      </div>
      <div className="font-medium text-foreground">
        {formatMeasurement(item)}
      </div>
      <div className="font-medium text-foreground">
        {formatOrderMoney(item.chargedUnitAmount, currency)}
        {item.chargedUnitAmount !== item.standardUnitAmount ? (
          <div className="text-xs text-amber-700">
            标准 {formatOrderMoney(item.standardUnitAmount, currency)}
          </div>
        ) : null}
      </div>
      <div className="text-right font-semibold text-foreground">
        {formatOrderMoney(item.lineAmount, currency)}
      </div>
      <div className="flex justify-end gap-1">
        <button
          aria-label="编辑条目"
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
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
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
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
      <div className="truncate font-semibold text-foreground">
        {item.itemName}
      </div>
      {item.itemKind === "product" && item.sku ? (
        <div className="mt-1 font-mono text-[11px] text-muted-foreground">
          SKU {item.sku}
        </div>
      ) : null}
      {item.itemIdentifier ? (
        <div className="mt-1 font-mono text-[11px] text-foreground">
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
    <div className="mt-2 text-xs leading-5 text-muted-foreground">
      {details.join(" · ")}
    </div>
  ) : null;
}

function formatMeasurement(item: PosOrderItem): string {
  return item.pricingUnit === "per_kg"
    ? `${item.weight ?? "0"} kg${item.bagCount ? ` · ${item.bagCount} 袋` : ""}`
    : `${item.quantity} ${item.unitOfMeasure ?? "件"}`;
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
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-muted disabled:text-muted-foreground";

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
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">
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
    <label className="grid gap-2 text-sm font-medium text-foreground">
      {label}
      <textarea
        className="min-h-20 rounded-md border bg-background px-3 py-2 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-muted"
        disabled={disabled}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}
