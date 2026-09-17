"use client";

import { posMessage } from "@/lib/pos-message";
import { posToast as toast } from "@/lib/pos-toast";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@cleanhub/ui";
import { useMemo, useState, useTransition } from "react";

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
  TICKET_DEFECT_QUICK_PHRASES,
  TICKET_ITEM_STATUS_TRANSITIONS,
  getTicketItemStatusLabel,
  getTicketItemTypeOptions,
  TICKET_REMARK_QUICK_PHRASES,
  TICKET_REQUEST_QUICK_PHRASES,
  formatTicketMoney,
} from "../constants";
import {
  loadCachedTicketBrands,
  rememberTicketBrand,
} from "../lib/ticket-brand-cache";
import { coerceTicketItemType, validateTicketItemForm } from "../validators";
import type { TicketItemFormValues } from "../types";
import { TicketItemStatusBadge } from "./ticket-badges";
import type {
  PosCatalogService,
  ServiceTicketItem,
  ServiceTicketItemStatus,
  ServiceTicketStatus,
} from "@cleanhub/api-client";
import {
  TicketAttributePicker,
  TicketServicePicker,
} from "./ticket-item-pickers";

type TicketItemEditorProps = {
  canManage: boolean;
  catalog: PosCatalogService[];
  ticketId: string;
  ticketStatus: ServiceTicketStatus;
  /** Service the clerk started intake from; prefills the first new item. */
  prefillServiceId?: string;
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
  ticketStatus,
  prefillServiceId,
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
    // Carry over the service the clerk came in with, so intake that started
    // from a service does not ask them to find it again.
    const preselected = prefillServiceId
      ? catalog.find((service) => service.id === prefillServiceId)
      : undefined;
    // The service picker is filtered by item type, so preselect the type when
    // the service allows only one. Otherwise the service still rides along:
    // changeItemType keeps it as soon as the clerk picks a compatible type.
    const onlyItemType =
      preselected?.applicableItemTypes.length === 1
        ? preselected.applicableItemTypes[0]
        : "";
    setForm(
      preselected
        ? {
            ...EMPTY_ITEM_FORM,
            itemType: onlyItemType,
            serviceId: preselected.id,
            pricingUnit: preselected.pricingUnit,
            standardUnitAmount: preselected.amount,
            chargedUnitAmount: preselected.amount,
            priceTouched: true,
            quantity: "1",
            bagCount: "1",
          }
        : EMPTY_ITEM_FORM,
    );
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
  // Mirrors the server: a settled ticket is frozen, and a draft has to be
  // confirmed before the shop floor can start moving garments through.
  const ticketEditable =
    ticketStatus !== "picked_up" && ticketStatus !== "cancelled";
  const itemsWorkable = ticketEditable && ticketStatus !== "draft";

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="flex-row items-center justify-between border-b py-5">
        <div>
          <CardTitle className="text-base">工单项目</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} 个项目 · 数量{" "}
            {items.reduce((n, x) => n + x.quantity, 0)}
          </p>
        </div>
        {ticketEditable ? (
          <Button onClick={startCreate} size="lg" type="button">
            <Icon className="h-4 w-4" name="plus" />
            添加项目
          </Button>
        ) : null}
      </CardHeader>

      {ticketStatus === "draft" ? (
        <p className="border-b bg-muted/40 px-5 py-3 text-xs text-muted-foreground">
          工单还是草稿，项目暂时不能流转。点击右上角「确认工单」后即可开始清洗。
        </p>
      ) : null}

      <div className="divide-y">
        {items.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
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
            ticketEditable={ticketEditable}
            ticketId={ticketId}
            workable={itemsWorkable}
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
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-4xl"
          onEscapeKeyDown={(event) => {
            if (
              document.activeElement?.closest("[data-ticket-attribute-picker]")
            ) {
              event.preventDefault();
            }
          }}
        >
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
    </Card>
  );
}

function ItemRow({
  canManage,
  ticketEditable,
  workable,
  currency,
  item,
  onEdit,
  ticketId,
}: {
  canManage: boolean;
  ticketEditable: boolean;
  workable: boolean;
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
        toast.success(
          posMessage("pos.inline.ticketItemStatusUpdated", {
            status: getTicketItemStatusLabel(next),
          }),
        );
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

  const reachable = workable
    ? (TICKET_ITEM_STATUS_TRANSITIONS[item.itemStatus] ?? [])
    : [];
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
          <div className="text-base font-semibold text-foreground">
            {item.itemName}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {details || "—"}
          </div>
          {item.labelCode ? (
            <div className="mt-1 font-mono text-[11px] text-foreground">
              标签 {item.labelCode}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            aria-label="修改项目"
            disabled={isPending || !ticketEditable}
            onClick={onEdit}
            size="icon-lg"
            title="修改项目"
            type="button"
            variant="outline"
          >
            <Icon className="h-4 w-4" name="square-pen" />
          </Button>
          {canManage && ticketEditable ? (
            <Button
              aria-label="删除项目"
              disabled={isPending}
              onClick={() => setDeleteOpen(true)}
              size="icon-lg"
              title="删除项目"
              type="button"
              variant="destructive"
            >
              <Icon className="h-4 w-4" name="trash" />
            </Button>
          ) : null}
        </div>
      </div>

      {item.defectNotes || item.specialRequest ? (
        <div className="mt-3 space-y-1 rounded-md border border-amber-200/70 bg-amber-50/60 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
          {item.defectNotes ? (
            <div className="text-xs text-foreground">
              <span className="font-semibold">瑕疵：</span>
              {item.defectNotes}
            </div>
          ) : null}
          {item.specialRequest ? (
            <div className="text-xs text-foreground">
              <span className="font-semibold">要求：</span>
              {item.specialRequest}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-md bg-muted/40 p-3 sm:grid-cols-3">
        <div>
          <div className="text-xs text-muted-foreground">项目状态</div>
          <div className="mt-1">
            <TicketItemStatusBadge status={item.itemStatus} />
          </div>
          {reachable.length > 0 ? (
            <Select
              disabled={isPending}
              onValueChange={(value) =>
                changeStatus(value as ServiceTicketItemStatus)
              }
            >
              <SelectTrigger className="mt-2 h-11 w-full text-xs">
                <SelectValue placeholder="流转状态…" />
              </SelectTrigger>
              <SelectContent>
                {reachable.map((status) => (
                  <SelectItem key={status} value={status}>
                    → {getTicketItemStatusLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
        <div>
          <div className="text-xs text-muted-foreground">
            {item.pricingUnit === "per_kg" ? "重量 / 单价" : "数量 / 单价"}
          </div>
          <div className="mt-1 text-sm font-medium text-foreground">
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
          <div className="text-xs text-muted-foreground">项目金额</div>
          <div className="mt-1 font-semibold text-foreground">
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
            <p className="text-sm text-muted-foreground">
              删除「{item.itemName}」会写入审计记录。
            </p>
            <Field label="删除原因（必填）" wide>
              <Textarea
                className="min-h-[88px]"
                disabled={isPending}
                maxLength={500}
                onChange={(event) => setDeleteReason(event.target.value)}
                value={deleteReason}
              />
            </Field>
            <DialogFooter>
              <Button
                disabled={isPending}
                onClick={() => setDeleteOpen(false)}
                type="button"
                variant="outline"
              >
                取消
              </Button>
              <Button
                disabled={isPending || !deleteReason.trim()}
                onClick={remove}
                type="button"
                variant="destructive"
              >
                {isPending ? "删除中…" : "确认删除"}
              </Button>
            </DialogFooter>
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
  const [cachedBrands, setCachedBrands] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : loadCachedTicketBrands(),
  );

  const compatibleCatalog = useMemo(() => {
    const itemType = form.itemType;
    return itemType
      ? catalog.filter((service) =>
          service.applicableItemTypes.includes(itemType),
        )
      : [];
  }, [catalog, form.itemType]);

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

  function changeItemType(itemType: ReturnType<typeof coerceTicketItemType>) {
    const selectedService = catalog.find(
      (service) => service.id === form.serviceId,
    );
    const keepService =
      itemType !== "" &&
      (selectedService?.applicableItemTypes.includes(itemType) ?? false);

    onChange({
      ...form,
      itemType,
      ...(keepService
        ? {}
        : {
            serviceId: "",
            pricingUnit: "per_item",
            standardUnitAmount: "0",
            chargedUnitAmount: "0",
            priceTouched: false,
            weight: "",
            bagCount: "1",
            overrideReason: "",
          }),
    });
  }

  function toggleQuickPhrase(
    field: "defectNotes" | "specialRequest" | "remark",
    phrase: string,
  ) {
    const current = form[field].trim();
    const phrases = current
      .split(/[；;\n]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    const next = phrases.includes(phrase)
      ? phrases.filter((value) => value !== phrase)
      : [...phrases, phrase];
    update(field, next.join("；"));
  }

  const brandOptions = useMemo(() => {
    const presetValues = new Set(
      ITEM_BRAND_OPTIONS.map((option) => option.value.toLocaleLowerCase()),
    );
    return [
      ...ITEM_BRAND_OPTIONS,
      ...cachedBrands
        .filter((brand) => !presetValues.has(brand.toLocaleLowerCase()))
        .map((brand) => ({ label: brand, value: brand })),
    ];
  }, [cachedBrands]);

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
    const itemType = coerceTicketItemType(form.itemType);
    if (!itemType) {
      toast.error("请先选择物品类型");
      return;
    }

    const payload = {
      serviceId: form.serviceId,
      itemType,
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="物品类型（必填）" wide>
          <Select
            disabled={isPending}
            onValueChange={(value) =>
              changeItemType(coerceTicketItemType(value))
            }
            value={form.itemType}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="请先选择物品类型" />
            </SelectTrigger>
            <SelectContent>
              {getTicketItemTypeOptions().map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="服务项目（必填）" wide>
          <TicketServicePicker
            disabled={isPending || !form.itemType}
            onValueChange={(service) => {
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
            services={compatibleCatalog}
            value={form.serviceId}
          />
          {!form.itemType ? (
            <span className="mt-1.5 block text-xs text-muted-foreground">
              选择物品类型后，仅显示适用于该物品的服务。
            </span>
          ) : compatibleCatalog.length === 0 ? (
            <span className="mt-1.5 block text-xs text-amber-700">
              当前物品类型没有可用服务，请先在管理后台配置服务的适用物品。
            </span>
          ) : null}
        </Field>
        <Field label="分类">
          <Input
            onChange={(event) => update("itemCategory", event.target.value)}
            value={form.itemCategory}
          />
        </Field>
        <Field label="颜色">
          <TicketAttributePicker
            options={ITEM_COLOR_OPTIONS}
            value={form.itemColor}
            onValueChange={(v) => update("itemColor", v)}
            placeholder="选择颜色…"
            searchPlaceholder="搜索颜色…"
            emptyText="无匹配颜色，按回车自定义"
          />
        </Field>
        <Field label="品牌">
          <TicketAttributePicker
            options={brandOptions}
            value={form.itemBrand}
            onValueChange={(value) => {
              update("itemBrand", value);
              setCachedBrands(rememberTicketBrand(value));
            }}
            placeholder="选择品牌…"
            searchPlaceholder="搜索品牌…"
            emptyText="无匹配品牌，按回车自定义"
          />
        </Field>
        <Field label="材质">
          <TicketAttributePicker
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
              <Input
                min="0.001"
                onChange={(event) => update("weight", event.target.value)}
                onWheel={handleNumberInputWheel}
                step="0.001"
                type="number"
                value={form.weight}
              />
            </Field>
            <Field label="袋数">
              <Input
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
            <Input
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
          <Input
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
          <Input
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
            <Textarea
              className="min-h-[72px]"
              maxLength={500}
              onChange={(event) => update("overrideReason", event.target.value)}
              value={form.overrideReason}
            />
          </Field>
        ) : null}
        <Field label="瑕疵" wide>
          <Textarea
            className="min-h-[72px]"
            onChange={(event) => update("defectNotes", event.target.value)}
            value={form.defectNotes}
          />
          <QuickPhrasePicker
            onSelect={(phrase) => toggleQuickPhrase("defectNotes", phrase)}
            options={TICKET_DEFECT_QUICK_PHRASES}
            value={form.defectNotes}
          />
        </Field>
        <Field label="特殊要求" wide>
          <Textarea
            className="min-h-[72px]"
            onChange={(event) => update("specialRequest", event.target.value)}
            value={form.specialRequest}
          />
          <QuickPhrasePicker
            onSelect={(phrase) => toggleQuickPhrase("specialRequest", phrase)}
            options={TICKET_REQUEST_QUICK_PHRASES}
            value={form.specialRequest}
          />
        </Field>
        <Field label="项目备注" wide>
          <Textarea
            className="min-h-[72px]"
            onChange={(event) => update("remark", event.target.value)}
            value={form.remark}
          />
          <QuickPhrasePicker
            onSelect={(phrase) => toggleQuickPhrase("remark", phrase)}
            options={TICKET_REMARK_QUICK_PHRASES}
            value={form.remark}
          />
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t pt-4">
        <Button
          disabled={isPending}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          取消
        </Button>
        <Button disabled={isPending} type="submit">
          <Icon className="h-4 w-4" name="save" />
          {isPending ? "保存中…" : "保存"}
        </Button>
      </div>
    </form>
  );
}

function QuickPhrasePicker({
  onSelect,
  options,
  value,
}: {
  onSelect: (phrase: string) => void;
  options: readonly string[];
  value: string;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5" aria-label="常用词条">
      {options.map((option) => {
        const selected = value
          .split(/[；;\n]+/)
          .map((part) => part.trim())
          .includes(option);

        return (
          <Button
            aria-pressed={selected}
            className="rounded-full"
            key={option}
            onClick={() => onSelect(option)}
            size="sm"
            type="button"
            variant={selected ? "default" : "outline"}
          >
            {option}
          </Button>
        );
      })}
    </div>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const className = wide ? "sm:col-span-2 lg:col-span-3" : "";
  const content = (
    <>
      <Label className="mb-1.5 block text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </>
  );

  return <div className={className}>{content}</div>;
}
