"use client";

import { posToast as toast } from "@/lib/pos-toast";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import { buildPosReceiptText } from "@cleanhub/hardware";
import { createId } from "@cleanhub/id";
import { calendarDateEndToUtc } from "@cleanhub/domain/timezone";
import { createScopedPrintJobQueue } from "@cleanhub/offline";
import type {
  CreateManualOrderRequest,
  CreatePosOrderRequest,
  PosCatalogService,
  PosCustomerProfileWithAccount,
  ServiceTicketSummary,
} from "@cleanhub/api-client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cleanhub/ui";

import { Icon, type PosIconName } from "@/components/app-shell";
import { translatePosText } from "@/components/i18n/pos-runtime-text";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { posRoutes } from "@/config";
import { PrintJobControl } from "@/features/hardware/components/print-job-control";
import { getPosOfflineStorage } from "@/features/hardware/lib/desktop-bridge";
import {
  notifyPosPrintQueueUpdated,
  type PosPrintJobPayload,
} from "@/features/hardware/lib/pos-print-job";
import { usePosOfflineWrites } from "@/features/offline/lib";
import { getPosApiErrorMessage } from "@/lib/api-error-message";
import { posApi } from "@/lib/api-client";
import { DEFAULT_POS_CURRENCY, normalizeCurrencyCode } from "@/lib/money";

import { formatOrderMoney } from "../constants";

type ManualItemForm = {
  key: string;
  serviceId: string;
  pricingUnit: "per_item" | "per_kg";
  standardUnitAmount: string;
  chargedUnitAmount: string;
  priceTouched: boolean;
  quantity: string;
  weight: string;
  bagCount: string;
  overrideReason: string;
  itemColor: string;
  defectNotes: string;
  specialRequest: string;
  itemIdentifier: string;
};

type OfflineOrderReceipt = {
  content: string;
  entityId: string;
  title: string;
};

function emptyItem(): ManualItemForm {
  return {
    key: `${Date.now()}-${Math.random()}`,
    serviceId: "",
    pricingUnit: "per_item",
    standardUnitAmount: "0",
    chargedUnitAmount: "0",
    priceTouched: false,
    quantity: "1",
    weight: "",
    bagCount: "1",
    overrideReason: "",
    itemColor: "",
    defectNotes: "",
    specialRequest: "",
    itemIdentifier: "",
  };
}

function toIsoOrNull(value: string, timeZone: string): string | null {
  if (!value) {
    return null;
  }
  return calendarDateEndToUtc(value, timeZone).toISOString();
}

type OrderCreateDialogProps = {
  canManageSensitiveOperations?: boolean;
  catalog?: PosCatalogService[];
  defaultBranchId?: string;
  initialTicket?: ServiceTicketSummary;
  orderDetailHref?: (orderId: string) => string;
  triggerClassName?: string;
  triggerIcon?: PosIconName;
  triggerLabel?: string;
};

export function OrderCreateDialog({
  canManageSensitiveOperations = false,
  catalog = [],
  defaultBranchId,
  initialTicket,
  orderDetailHref,
  triggerClassName,
  triggerIcon = "plus",
  triggerLabel = "新增订单",
}: OrderCreateDialogProps) {
  const { locale } = useTranslation();
  const text = (value: string) => translatePosText(value, locale);
  const router = useRouter();
  const {
    branchId: runtimeBranchId,
    currency: runtimeCurrency,
    tenantId: runtimeTenantId,
    terminalId: runtimeTerminalId,
    timeZone,
  } = usePosRuntimeConfig();
  const { createOrder } = usePosOfflineWrites();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [orderType, setOrderType] = useState<"manual" | "ticket">(
    initialTicket ? "ticket" : "manual",
  );
  const [selectedCustomer, setSelectedCustomer] =
    useState<PosCustomerProfileWithAccount | null>(null);
  const [selectedTicket, setSelectedTicket] =
    useState<ServiceTicketSummary | null>(initialTicket ?? null);
  const [expireAt, setExpireAt] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ManualItemForm[]>([emptyItem()]);
  const [offlineReceipt, setOfflineReceipt] =
    useState<OfflineOrderReceipt | null>(null);
  const ticketModeLocked = Boolean(initialTicket);

  function resetForm() {
    setOrderType(initialTicket ? "ticket" : "manual");
    setSelectedCustomer(null);
    setSelectedTicket(initialTicket ?? null);
    setExpireAt("");
    setNotes("");
    setItems([emptyItem()]);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  }

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
      if (!selectedTicket) {
        toast.error("请选择要生成订单的工单。");
        return null;
      }
      return {
        orderType: "ticket",
        ticketId: selectedTicket.id,
        expireAt: toIsoOrNull(expireAt, timeZone),
        notes: normalizedNotes,
      };
    }

    if (!defaultBranchId) {
      toast.error("当前门店加载失败，无法创建普通订单。");
      return null;
    }

    if (!selectedCustomer) {
      toast.error("请选择客户档案。");
      return null;
    }

    const normalizedItems = items.map((item) => ({
      serviceId: item.serviceId,
      quantity:
        item.pricingUnit === "per_item" ? item.quantity.trim() : undefined,
      weight: item.pricingUnit === "per_kg" ? item.weight.trim() : undefined,
      bagCount:
        item.pricingUnit === "per_kg" ? Number(item.bagCount) : undefined,
      chargedUnitAmount: item.chargedUnitAmount.trim(),
      overrideReason: item.overrideReason.trim() || undefined,
      itemColor: item.itemColor.trim() || undefined,
      defectNotes: item.defectNotes.trim() || undefined,
      specialRequest: item.specialRequest.trim() || undefined,
      itemIdentifier: item.itemIdentifier.trim() || undefined,
      pricingUnit: item.pricingUnit,
      standardUnitAmount: item.standardUnitAmount,
      priceTouched: item.priceTouched,
    }));

    if (
      normalizedItems.some(
        (item) =>
          !item.serviceId ||
          (item.pricingUnit === "per_item" &&
            (!Number.isInteger(Number(item.quantity)) ||
              Number(item.quantity) < 1)) ||
          (item.pricingUnit === "per_kg" &&
            (Number(item.weight) <= 0 ||
              !Number.isInteger(item.bagCount) ||
              (item.bagCount ?? 0) < 1)) ||
          Number(item.chargedUnitAmount) <= 0 ||
          (item.priceTouched &&
            Number(item.chargedUnitAmount).toFixed(2) !==
              Number(item.standardUnitAmount).toFixed(2) &&
            !item.overrideReason),
      )
    ) {
      toast.error("请完整填写订单条目。");
      return null;
    }

    return {
      orderType: "manual",
      branchId: defaultBranchId,
      customerId: selectedCustomer.id,
      items: normalizedItems.map((item) => ({
        serviceId: item.serviceId,
        quantity: item.quantity,
        weight: item.weight,
        bagCount: item.bagCount,
        chargedUnitAmount: item.chargedUnitAmount,
        overrideReason: item.overrideReason,
        itemColor: item.itemColor,
        defectNotes: item.defectNotes,
        specialRequest: item.specialRequest,
        itemIdentifier: item.itemIdentifier,
      })),
      expireAt: toIsoOrNull(expireAt, timeZone),
      notes: normalizedNotes,
    };
  }

  function submit() {
    const payload = buildPayload();
    if (!payload) {
      return;
    }

    startTransition(async () => {
      let result: Awaited<ReturnType<typeof createOrder>>;
      try {
        result = await createOrder(payload);
      } catch (error) {
        toast.error(getPosApiErrorMessage(error, "订单创建失败，请重试。"));
        return;
      }

      if (result.queued) {
        try {
          const receipt = buildOfflineOrderReceipt({
            catalog,
            customer: selectedCustomer,
            entityId: result.entityId,
            locale,
            payload,
            runtimeCurrency,
            ticket: selectedTicket,
          });
          const receiptPersisted = await persistOfflineReceipt({
            branchId: runtimeBranchId,
            receipt,
            tenantId: runtimeTenantId,
            terminalId: runtimeTerminalId,
          });
          setOfflineReceipt(receipt);
          toast.success(
            receiptPersisted
              ? "网络不可用，订单和待打印小票已本地保存。"
              : "网络不可用，订单已本地保存，可立即打印小票。",
          );
          handleOpenChange(false);
        } catch (receiptError) {
          toast.warning(
            getPosApiErrorMessage(
              receiptError,
              "订单已本地保存，但暂存小票生成失败；请勿重复创建订单。",
            ),
          );
          handleOpenChange(false);
        }
        return;
      }

      toast.success("订单已创建。");
      handleOpenChange(false);
      router.push(
        orderDetailHref?.(result.data.id) ??
          posRoutes.orderDetail(result.data.id),
      );
    });
  }

  return (
    <>
      <button
        className={
          triggerClassName ??
          "flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        }
        onClick={() => setOpen(true)}
        type="button"
      >
        <Icon className="h-4 w-4" name={triggerIcon} />
        {translatePosText(triggerLabel, locale)}
      </button>

      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{text("新增订单")}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-5">
            {ticketModeLocked ? null : (
              <div className="inline-grid w-fit grid-cols-2 rounded-lg border border-border bg-muted/50 p-1">
                {(["manual", "ticket"] as const).map((value) => (
                  <button
                    className={`h-11 rounded-md px-4 text-sm font-semibold ${
                      orderType === value
                        ? "bg-background text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    key={value}
                    onClick={() => setOrderType(value)}
                    type="button"
                  >
                    {text(value === "manual" ? "普通订单" : "工单订单")}
                  </button>
                ))}
              </div>
            )}

            {orderType === "manual" ? (
              <ManualOrderFields
                canOverridePrice={canManageSensitiveOperations}
                catalog={catalog}
                currency={runtimeCurrency}
                selectedCustomer={selectedCustomer}
                items={items}
                onAddItem={() =>
                  setItems((current) => [...current, emptyItem()])
                }
                onRemoveItem={(index) =>
                  setItems((current) =>
                    current.length === 1
                      ? current
                      : current.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
                onSelectCustomer={setSelectedCustomer}
                onUpdateItem={updateItem}
              />
            ) : (
              <TicketOrderFields
                locked={ticketModeLocked}
                selectedTicket={selectedTicket}
                onSelectTicket={setSelectedTicket}
              />
            )}

            <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
              <Field label={text("过期日期")}>
                <input
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
                  onChange={(event) => setExpireAt(event.target.value)}
                  type="date"
                  value={expireAt}
                />
              </Field>
              <Field label={text("备注")}>
                <input
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={text("选填")}
                  value={notes}
                />
              </Field>
            </div>
          </div>

          <DialogFooter>
            <button
              className="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
              type="button"
            >
              {text("取消")}
            </button>
            <button
              className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              disabled={isPending}
              onClick={submit}
              type="button"
            >
              {text(isPending ? "创建中..." : "创建订单")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setOfflineReceipt(null);
        }}
        open={Boolean(offlineReceipt)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{text("离线订单已保存")}</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-950">
            {text(
              "订单已保存在当前终端，恢复网络后会自动同步。现在可以直接打印本地小票。",
            )}
          </div>
          {offlineReceipt ? (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 text-xs leading-5 text-foreground">
              {offlineReceipt.content}
            </pre>
          ) : null}
          <DialogFooter>
            <button
              className="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-muted"
              onClick={() => setOfflineReceipt(null)}
              type="button"
            >
              {text("稍后处理")}
            </button>
            {offlineReceipt ? (
              <PrintJobControl
                canReprint={canManageSensitiveOperations}
                content={offlineReceipt.content}
                documentType="receipt"
                entityId={offlineReceipt.entityId}
                initialLabel={text("打印离线小票")}
                title={offlineReceipt.title}
              />
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function buildOfflineOrderReceipt(input: {
  catalog: PosCatalogService[];
  customer: PosCustomerProfileWithAccount | null;
  entityId: string;
  locale: SupportedLocale;
  payload: CreatePosOrderRequest;
  runtimeCurrency?: string;
  ticket: ServiceTicketSummary | null;
}): OfflineOrderReceipt {
  const manualPayload =
    input.payload.orderType === "manual" ? input.payload : null;
  const currency = resolveReceiptCurrency(
    manualPayload
      ? (input.runtimeCurrency ??
          input.catalog.find(
            (service) => service.id === manualPayload.items[0]?.serviceId,
          )?.currency ??
          DEFAULT_POS_CURRENCY)
      : (input.runtimeCurrency ?? DEFAULT_POS_CURRENCY),
  );
  const receiptItems = manualPayload
    ? buildOfflineManualReceiptItems(manualPayload, input.catalog, currency)
    : [
        {
          name: input.ticket?.ticketNo
            ? `Ticket ${input.ticket.ticketNo}`
            : "Service ticket",
          quantity: Math.max(1, input.ticket?.itemCount ?? 1),
          unitAmountMinor: toMinorUnits(
            Number(input.ticket?.totalAmount ?? 0) /
              Math.max(1, input.ticket?.itemCount ?? 1),
            currency,
          ),
          totalAmountMinor: toMinorUnits(
            Number(input.ticket?.totalAmount ?? 0),
            currency,
          ),
        },
      ];
  const totalMinor = receiptItems.reduce(
    (total, item) => total + item.totalAmountMinor,
    0,
  );
  const code = `OFF-${input.entityId.slice(-8).toUpperCase()}`;

  return {
    entityId: input.entityId,
    title: code,
    content: buildPosReceiptText(
      {
        receiptNo: code,
        orderCode: code,
        issuedAt: new Date(),
        currency,
        merchantName: "CleanHub · Offline",
        customerName:
          input.customer?.fullName ?? input.ticket?.customerName ?? undefined,
        items: receiptItems,
        subtotalMinor: totalMinor,
        discountMinor: 0,
        totalMinor,
        paidMinor: 0,
        balanceMinor: totalMinor,
        footer:
          input.locale === "zh-CN"
            ? "离线暂存单 · 待同步 · 金额以同步成功后的正式订单为准"
            : input.locale === "fr"
              ? "Brouillon hors ligne · Le montant final sera confirmé après synchronisation"
              : "Offline draft · Final amount is confirmed after sync",
      },
      { locale: input.locale },
    ),
  };
}

async function persistOfflineReceipt(input: {
  branchId: string | null;
  receipt: OfflineOrderReceipt;
  tenantId: string | null;
  terminalId: string | null;
}): Promise<boolean> {
  if (!input.tenantId || !input.branchId || !input.terminalId) {
    return false;
  }

  const queue = createScopedPrintJobQueue<PosPrintJobPayload>({
    storage: getPosOfflineStorage(),
    scope: {
      tenantId: input.tenantId,
      branchId: input.branchId,
      terminalId: input.terminalId,
    },
  });
  await queue.enqueue({
    id: createId(),
    idempotencyKey: `pos-print:receipt:${input.receipt.entityId}:initial`,
    payload: {
      documentType: "receipt",
      entityId: input.receipt.entityId,
      title: input.receipt.title,
      content: input.receipt.content,
    },
  });
  notifyPosPrintQueueUpdated();
  return true;
}

function resolveReceiptCurrency(value: string): string {
  const normalized = normalizeCurrencyCode(value);
  try {
    new Intl.NumberFormat("en", {
      style: "currency",
      currency: normalized,
    }).format(0);
    return normalized;
  } catch {
    return DEFAULT_POS_CURRENCY;
  }
}

function buildOfflineManualReceiptItems(
  payload: CreateManualOrderRequest,
  catalog: PosCatalogService[],
  currency: string,
) {
  return payload.items.map((item) => {
    const service = catalog.find(
      (candidate) => candidate.id === item.serviceId,
    );
    const quantity = item.weight
      ? Number(item.weight)
      : Number(item.quantity ?? 1);
    const unitAmount = Number(item.chargedUnitAmount ?? service?.amount ?? 0);
    const safeQuantity =
      Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    const safeUnitAmount = Number.isFinite(unitAmount) ? unitAmount : 0;

    return {
      name: service?.name ?? item.serviceId,
      quantity: safeQuantity,
      unitAmountMinor: toMinorUnits(safeUnitAmount, currency),
      totalAmountMinor: toMinorUnits(safeQuantity * safeUnitAmount, currency),
      note:
        [item.itemColor, item.defectNotes, item.specialRequest]
          .filter(Boolean)
          .join("; ") || undefined,
    };
  });
}

function toMinorUnits(value: number, currency: string): number {
  const fractionDigits =
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  return Math.round(value * 10 ** fractionDigits);
}

function ManualOrderFields({
  canOverridePrice,
  catalog,
  currency,
  selectedCustomer,
  items,
  onSelectCustomer,
  onUpdateItem,
  onAddItem,
  onRemoveItem,
}: {
  canOverridePrice: boolean;
  catalog: PosCatalogService[];
  currency: string;
  selectedCustomer: PosCustomerProfileWithAccount | null;
  items: ManualItemForm[];
  onSelectCustomer: (customer: PosCustomerProfileWithAccount | null) => void;
  onUpdateItem: (index: number, patch: Partial<ManualItemForm>) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
}) {
  const { locale } = useTranslation();
  const text = (value: string) => translatePosText(value, locale);

  return (
    <div className="grid gap-4">
      <CustomerProfilePicker
        onSelect={onSelectCustomer}
        selectedCustomer={selectedCustomer}
      />

      <div className="rounded-lg border border-border">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="text-sm font-semibold text-foreground">
            {text("订单条目")}
          </div>
          <button
            className="flex h-11 items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onAddItem}
            type="button"
          >
            <Icon className="h-3.5 w-3.5" name="plus" />
            {text("添加条目")}
          </button>
        </div>
        <div className="grid gap-3 p-4">
          {items.map((item, index) => (
            <div
              className="grid min-w-0 gap-3 rounded-lg bg-muted/50 p-3 md:grid-cols-2 lg:grid-cols-3"
              key={item.key}
            >
              <label className="md:col-span-2 lg:col-span-3">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                  {text("服务项目")}
                </span>
                <select
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
                  onChange={(event) => {
                    const service = catalog.find(
                      (entry) => entry.id === event.target.value,
                    );
                    if (!service) {
                      onUpdateItem(index, { serviceId: "" });
                      return;
                    }
                    onUpdateItem(index, {
                      serviceId: service.id,
                      pricingUnit: service.pricingUnit,
                      standardUnitAmount: service.amount,
                      chargedUnitAmount: service.amount,
                      priceTouched: true,
                      quantity:
                        service.pricingUnit === "per_item"
                          ? item.quantity || "1"
                          : "1",
                      weight:
                        service.pricingUnit === "per_kg" ? item.weight : "",
                      bagCount:
                        service.pricingUnit === "per_kg"
                          ? item.bagCount || "1"
                          : "1",
                      overrideReason: "",
                    });
                  }}
                  value={item.serviceId}
                >
                  <option value="">{text("请选择服务")}</option>
                  {catalog.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} ·{" "}
                      {text(
                        service.pricingUnit === "per_kg" ? "按公斤" : "按件",
                      )}{" "}
                      · {formatOrderMoney(service.amount, service.currency)}
                    </option>
                  ))}
                </select>
              </label>
              {item.pricingUnit === "per_kg" ? (
                <>
                  <TextField
                    label="重量（kg）"
                    onChange={(value) => onUpdateItem(index, { weight: value })}
                    type="number"
                    value={item.weight}
                  />
                  <TextField
                    label="袋数"
                    onChange={(value) =>
                      onUpdateItem(index, { bagCount: value })
                    }
                    type="number"
                    value={item.bagCount}
                  />
                </>
              ) : (
                <TextField
                  label="数量"
                  onChange={(value) => onUpdateItem(index, { quantity: value })}
                  type="number"
                  value={item.quantity}
                />
              )}
              <TextField
                disabled={!canOverridePrice}
                label={text(canOverridePrice ? "收费单价" : "标准单价")}
                onChange={(value) =>
                  onUpdateItem(index, {
                    chargedUnitAmount: value,
                    priceTouched: true,
                  })
                }
                type="number"
                value={item.chargedUnitAmount}
              />
              <div className="rounded-lg border border-border bg-background px-3 py-2">
                <div className="text-xs font-semibold text-muted-foreground">
                  {text("小计")}
                </div>
                <div className="mt-1 font-semibold text-foreground">
                  {formatOrderMoney(
                    (item.pricingUnit === "per_kg"
                      ? Number(item.weight) || 0
                      : Number(item.quantity) || 0) *
                      (Number(item.chargedUnitAmount) || 0),
                    currency,
                  )}
                </div>
              </div>
              <TextField
                label={text("颜色")}
                onChange={(value) => onUpdateItem(index, { itemColor: value })}
                value={item.itemColor}
              />
              <TextField
                label={text("物品 / 袋标识")}
                onChange={(value) =>
                  onUpdateItem(index, { itemIdentifier: value })
                }
                value={item.itemIdentifier}
              />
              <TextField
                label={text("瑕疵")}
                onChange={(value) =>
                  onUpdateItem(index, { defectNotes: value })
                }
                value={item.defectNotes}
              />
              <TextField
                label={text("特殊要求")}
                onChange={(value) =>
                  onUpdateItem(index, { specialRequest: value })
                }
                value={item.specialRequest}
              />
              {canOverridePrice &&
              item.priceTouched &&
              Number(item.chargedUnitAmount).toFixed(2) !==
                Number(item.standardUnitAmount).toFixed(2) ? (
                <TextField
                  label={text("改价原因（必填）")}
                  onChange={(value) =>
                    onUpdateItem(index, { overrideReason: value })
                  }
                  value={item.overrideReason}
                />
              ) : null}
              <button
                aria-label={text("删除条目")}
                className="flex h-11 w-11 items-center justify-center justify-self-end rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 md:col-span-2 lg:col-span-3"
                disabled={items.length === 1}
                onClick={() => onRemoveItem(index)}
                title={text("删除条目")}
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
  locked = false,
  selectedTicket,
  onSelectTicket,
}: {
  locked?: boolean;
  selectedTicket: ServiceTicketSummary | null;
  onSelectTicket: (ticket: ServiceTicketSummary | null) => void;
}) {
  const { locale } = useTranslation();

  return (
    <div className="grid gap-4">
      <ServiceTicketPicker
        locked={locked}
        onSelect={onSelectTicket}
        selectedTicket={selectedTicket}
      />
      <div className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
        {translatePosText(
          "选择工单后，系统会自动把该工单中尚未生成订单的项目全部带入订单。",
          locale,
        )}
      </div>
    </div>
  );
}

function CustomerProfilePicker({
  selectedCustomer,
  onSelect,
}: {
  selectedCustomer: PosCustomerProfileWithAccount | null;
  onSelect: (customer: PosCustomerProfileWithAccount | null) => void;
}) {
  const { locale } = useTranslation();
  const text = (value: string) => translatePosText(value, locale);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<PosCustomerProfileWithAccount[]>([]);
  const { listQueuedCustomerProfiles, pendingCount } = usePosOfflineWrites();

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      const normalizedKeyword = keyword.trim().toLowerCase();
      void Promise.allSettled([
        posApi.pos.customers.list(
          {
            q: keyword.trim() || undefined,
            resultType: "profile",
            status: "active",
            limit: 8,
            offset: 0,
          },
          { signal: controller.signal },
        ),
        listQueuedCustomerProfiles(),
      ])
        .then(([remoteResult, queuedResult]) => {
          if (!active) return;
          const remote =
            remoteResult.status === "fulfilled"
              ? remoteResult.value.data
                  .filter((entry) => entry.kind === "profile")
                  .map((entry) => entry.profile)
              : [];
          const queued =
            queuedResult.status === "fulfilled"
              ? queuedResult.value.filter((customer) => {
                  if (!normalizedKeyword) return true;
                  return [
                    customer.fullName,
                    customer.accountName,
                    customer.phone,
                    customer.email,
                  ].some((value) =>
                    String(value ?? "")
                      .toLowerCase()
                      .includes(normalizedKeyword),
                  );
                })
              : [];
          const merged = new Map<string, PosCustomerProfileWithAccount>();
          for (const customer of [...queued, ...remote]) {
            merged.set(customer.id, customer);
          }
          setOptions([...merged.values()].slice(0, 8));
        })
        .catch(() => {
          if (active) setOptions([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [keyword, listQueuedCustomerProfiles, pendingCount]);

  return (
    <Field label={text("客户档案")}>
      <div className="rounded-lg border border-border bg-muted/50 p-3">
        <input
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={text("搜索客户姓名、手机号或邮箱")}
          value={keyword}
        />
        {selectedCustomer ? (
          <SelectedPill
            label={selectedCustomer.fullName}
            meta={[
              selectedCustomer.accountName,
              selectedCustomer.phone,
              selectedCustomer.email,
            ]
              .filter(Boolean)
              .join(" · ")}
            onClear={() => onSelect(null)}
          />
        ) : null}
        <OptionList
          emptyText={text(loading ? "加载客户中..." : "没有匹配的客户档案")}
          options={options.map((customer) => ({
            id: customer.id,
            title: customer.fullName,
            meta: [customer.accountName, customer.phone, customer.email]
              .filter(Boolean)
              .join(" · "),
            onSelect: () => onSelect(customer),
          }))}
        />
      </div>
    </Field>
  );
}

function ServiceTicketPicker({
  locked = false,
  selectedTicket,
  onSelect,
}: {
  locked?: boolean;
  selectedTicket: ServiceTicketSummary | null;
  onSelect: (ticket: ServiceTicketSummary | null) => void;
}) {
  const { locale } = useTranslation();
  const text = (value: string) => translatePosText(value, locale);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ServiceTicketSummary[]>([]);

  useEffect(() => {
    if (locked) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void posApi.pos.serviceTickets
        .list({
          q: keyword.trim() || undefined,
          status: ["pending", "in_progress", "ready_to_pick"],
          limit: 8,
          offset: 0,
        })
        .then((result) => setOptions(result.data))
        .catch(() => setOptions([]))
        .finally(() => setLoading(false));
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [keyword, locked]);

  return (
    <Field label={text("服务工单")}>
      <div className="rounded-lg border border-border bg-muted/50 p-3">
        {locked ? null : (
          <input
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={text("搜索工单号或客户名")}
            value={keyword}
          />
        )}
        {selectedTicket ? (
          <SelectedPill
            label={selectedTicket.ticketNo ?? selectedTicket.id}
            meta={formatTicketMeta(selectedTicket, locale)}
            onClear={locked ? undefined : () => onSelect(null)}
          />
        ) : null}
        {locked ? null : (
          <OptionList
            emptyText={text(loading ? "加载工单中..." : "没有可生成订单的工单")}
            options={options.map((ticket) => ({
              id: ticket.id,
              title: ticket.ticketNo ?? ticket.id,
              meta: formatTicketMeta(ticket, locale),
              onSelect: () => onSelect(ticket),
            }))}
          />
        )}
      </div>
    </Field>
  );
}

function SelectedPill({
  label,
  meta,
  onClear,
}: {
  label: string;
  meta: string;
  onClear?: () => void;
}) {
  const { locale } = useTranslation();

  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-foreground">
          <RawText value={label} />
        </div>
        <div className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
          <RawText value={meta} />
        </div>
      </div>
      {onClear ? (
        <button
          className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onClear}
          type="button"
        >
          {translatePosText("清除", locale)}
        </button>
      ) : null}
    </div>
  );
}

function OptionList({
  emptyText,
  options,
}: {
  emptyText: string;
  options: Array<{
    id: string;
    title: string;
    meta: string;
    onSelect: () => void;
  }>;
}) {
  if (options.length === 0) {
    return (
      <div className="mt-3 text-xs font-medium text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="mt-3 max-h-52 overflow-y-auto rounded-lg border border-border bg-background">
      {options.map((option) => (
        <button
          className="block w-full border-b border-border px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          key={option.id}
          onClick={option.onSelect}
          type="button"
        >
          <div className="truncate text-sm font-semibold text-foreground">
            <RawText value={option.title} />
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            <RawText value={option.meta} />
          </div>
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function TextField({
  disabled,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  disabled?: boolean;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number";
}) {
  return (
    <Field label={label}>
      <input
        className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:bg-muted disabled:text-muted-foreground"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        step={type === "number" ? "0.001" : undefined}
        type={type}
        value={value}
      />
    </Field>
  );
}

function RawText({ value }: { value: string }) {
  return value;
}

function formatTicketMeta(
  ticket: ServiceTicketSummary,
  locale: SupportedLocale,
): string {
  const count = ticket.itemCount;
  if (locale === "en") {
    return `${ticket.customerName} · ${count} ${count === 1 ? "item" : "items"} · total ${ticket.totalAmount}`;
  }
  if (locale === "fr") {
    return `${ticket.customerName} · ${count} ${count === 1 ? "article" : "articles"} · total ${ticket.totalAmount}`;
  }
  return `${ticket.customerName} · ${count} 个项目 · 合计 ${ticket.totalAmount}`;
}
