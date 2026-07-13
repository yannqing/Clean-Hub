"use client";

import { posToast as toast } from "@/lib/pos-toast";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type {
  CreateManualOrderItemRequest,
  CreatePosOrderRequest,
  PosOrderItemSourceType,
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
import { posRoutes } from "@/config";
import { posApi } from "@/lib/api-client";

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

type OrderCreateDialogProps = {
  defaultBranchId?: string;
  initialTicket?: ServiceTicketSummary;
  orderDetailHref?: (orderId: string) => string;
  triggerClassName?: string;
  triggerIcon?: PosIconName;
  triggerLabel?: string;
};

export function OrderCreateDialog({
  defaultBranchId,
  initialTicket,
  orderDetailHref,
  triggerClassName,
  triggerIcon = "plus",
  triggerLabel = "新增订单",
}: OrderCreateDialogProps) {
  const router = useRouter();
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
        expireAt: toIsoOrNull(expireAt),
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
      sourceType: item.sourceType,
      itemName: item.itemName.trim(),
      quantity: item.quantity.trim(),
      unitAmount: item.unitAmount.trim(),
    }));

    if (
      normalizedItems.some(
        (item) =>
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
      branchId: defaultBranchId,
      customerId: selectedCustomer.id,
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
        handleOpenChange(false);
        router.push(
          orderDetailHref?.(result.data.id) ??
            posRoutes.orderDetail(result.data.id),
        );
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <>
      <button
        className={
          triggerClassName ??
          "flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
        }
        onClick={() => setOpen(true)}
        type="button"
      >
        <Icon className="h-4 w-4" name={triggerIcon} />
        {triggerLabel}
      </button>

      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>新增订单</DialogTitle>
          </DialogHeader>

          <div className="grid gap-5">
            {ticketModeLocked ? null : (
              <div className="inline-grid w-fit grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
                {(["manual", "ticket"] as const).map((value) => (
                  <button
                    className={`h-11 rounded-md px-4 text-sm font-semibold ${
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
            )}

            {orderType === "manual" ? (
              <ManualOrderFields
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
              onClick={() => handleOpenChange(false)}
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
  selectedCustomer,
  items,
  onSelectCustomer,
  onUpdateItem,
  onAddItem,
  onRemoveItem,
}: {
  selectedCustomer: PosCustomerProfileWithAccount | null;
  items: ManualItemForm[];
  onSelectCustomer: (customer: PosCustomerProfileWithAccount | null) => void;
  onUpdateItem: (index: number, patch: Partial<ManualItemForm>) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
}) {
  return (
    <div className="grid gap-4">
      <CustomerProfilePicker
        onSelect={onSelectCustomer}
        selectedCustomer={selectedCustomer}
      />

      <div className="rounded-lg border border-slate-200">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="text-sm font-semibold text-slate-800">订单条目</div>
          <button
            className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
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
                      sourceType: event.target
                        .value as ManualItemForm["sourceType"],
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
                className="mt-5 flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 md:mt-0 md:self-end xl:mt-5"
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
  locked = false,
  selectedTicket,
  onSelectTicket,
}: {
  locked?: boolean;
  selectedTicket: ServiceTicketSummary | null;
  onSelectTicket: (ticket: ServiceTicketSummary | null) => void;
}) {
  return (
    <div className="grid gap-4">
      <ServiceTicketPicker
        locked={locked}
        onSelect={onSelectTicket}
        selectedTicket={selectedTicket}
      />
      <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
        选择工单后，系统会自动把该工单中尚未生成订单的项目全部带入订单。
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
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<PosCustomerProfileWithAccount[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void posApi.pos.customers
        .list({
          q: keyword.trim() || undefined,
          resultType: "profile",
          status: "active",
          limit: 8,
          offset: 0,
        })
        .then((result) => {
          setOptions(
            result.data
              .filter((entry) => entry.kind === "profile")
              .map((entry) => entry.profile),
          );
        })
        .catch(() => setOptions([]))
        .finally(() => setLoading(false));
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [keyword]);

  return (
    <Field label="客户档案">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <input
          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索客户姓名、手机号或邮箱"
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
          emptyText={loading ? "加载客户中..." : "没有匹配的客户档案"}
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
    <Field label="服务工单">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        {locked ? null : (
          <input
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索工单号或客户名"
            value={keyword}
          />
        )}
        {selectedTicket ? (
          <SelectedPill
            label={selectedTicket.ticketNo ?? selectedTicket.id}
            meta={`${selectedTicket.customerName} · ${selectedTicket.itemCount} 个项目 · 合计 ${selectedTicket.totalAmount}`}
            onClear={locked ? undefined : () => onSelect(null)}
          />
        ) : null}
        {locked ? null : (
          <OptionList
            emptyText={loading ? "加载工单中..." : "没有可生成订单的工单"}
            options={options.map((ticket) => ({
              id: ticket.id,
              title: ticket.ticketNo ?? ticket.id,
              meta: `${ticket.customerName} · ${ticket.itemCount} 个项目 · 合计 ${ticket.totalAmount}`,
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
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-blue-50 px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-blue-900">
          {label}
        </div>
        <div className="mt-0.5 truncate text-xs font-medium text-blue-600">
          {meta}
        </div>
      </div>
      {onClear ? (
        <button
          className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-white"
          onClick={onClear}
          type="button"
        >
          清除
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
      <div className="mt-3 text-xs font-medium text-slate-400">{emptyText}</div>
    );
  }

  return (
    <div className="mt-3 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white">
      {options.map((option) => (
        <button
          className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50"
          key={option.id}
          onClick={option.onSelect}
          type="button"
        >
          <div className="truncate text-sm font-semibold text-slate-800">
            {option.title}
          </div>
          <div className="mt-0.5 truncate text-xs text-slate-500">
            {option.meta}
          </div>
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
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
