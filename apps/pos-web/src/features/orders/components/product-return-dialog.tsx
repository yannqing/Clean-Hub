"use client";

import type {
  PosCatalogProduct,
  PosOrderDetail,
  PosPaymentAdjustment,
  PosPaymentTransaction,
  PosProductReturnsOverview,
  PosReturnDisposition,
  PosReturnItemCondition,
} from "@cleanhub/api-client";
import { createId } from "@cleanhub/id";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@cleanhub/ui";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { posRoutes } from "@/config";
import { getPosApiErrorMessage } from "@/lib/api-error-message";
import { posApi } from "@/lib/api-client";
import { posToast as toast } from "@/lib/pos-toast";

import { formatOrderMoney } from "../constants";

type SelectedReturnItem = {
  quantity: string;
  condition: PosReturnItemCondition;
  disposition: PosReturnDisposition;
};

export function ProductReturnDialog({
  adjustments,
  order,
  payments,
  products,
}: {
  adjustments: PosPaymentAdjustment[];
  order: PosOrderDetail;
  payments: PosPaymentTransaction[];
  products: PosCatalogProduct[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [overview, setOverview] = useState<PosProductReturnsOverview | null>(null);
  const [selected, setSelected] = useState<Record<string, SelectedReturnItem>>({});
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [exchangeSkuId, setExchangeSkuId] = useState("");
  const [exchangeQuantity, setExchangeQuantity] = useState("1");
  const [exchangeItems, setExchangeItems] = useState<
    Array<{ productSkuId: string; quantity: string; name: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selectedItems = useMemo(
    () =>
      (overview?.returnableItems ?? [])
        .map((item) => ({ item, selection: selected[item.orderItemId] }))
        .filter(
          (entry): entry is typeof entry & { selection: SelectedReturnItem } =>
            Boolean(entry.selection && Number(entry.selection.quantity) > 0),
        ),
    [overview, selected],
  );
  const estimatedRefund = useMemo(() => {
    const gross = selectedItems.reduce(
      (sum, { item, selection }) =>
        sum +
        (Number(item.lineAmount) * Number(selection.quantity)) /
          Number(item.purchasedQuantity),
      0,
    );
    return Math.min(
      Number(order.paidAmount),
      Number(order.subtotalAmount) > 0
        ? (Number(order.totalAmount) * gross) / Number(order.subtotalAmount)
        : 0,
    );
  }, [order, selectedItems]);

  function load() {
    setLoading(true);
    void posApi.pos.orders
      .listProductReturns(order.id)
      .then(setOverview)
      .catch((error) => toast.error(getPosApiErrorMessage(error)))
      .finally(() => setLoading(false));
  }

  function updateSelection(
    orderItemId: string,
    patch: Partial<SelectedReturnItem>,
  ) {
    setSelected((current) => {
      const existing = current[orderItemId];
      const returnable = overview?.returnableItems.find(
        (item) => item.orderItemId === orderItemId,
      );
      return {
        ...current,
        [orderItemId]: existing
          ? { ...existing, ...patch }
          : {
              quantity: "0",
              condition: "good",
              disposition: returnable?.trackInventory ? "restock" : "discarded",
              ...patch,
            },
      };
    });
  }

  function addExchangeItem() {
    const product = products.find((entry) => entry.productSkuId === exchangeSkuId);
    if (!product || Number(exchangeQuantity) <= 0) return;
    setExchangeItems((current) => [
      ...current.filter((item) => item.productSkuId !== product.productSkuId),
      {
        productSkuId: product.productSkuId,
        quantity: Number(exchangeQuantity).toFixed(3).replace(/\.?0+$/, ""),
        name: product.variantName
          ? `${product.name} · ${product.variantName}`
          : product.name,
      },
    ]);
    setExchangeSkuId("");
    setExchangeQuantity("1");
  }

  function buildRefundAllocations(amount: number) {
    let remaining = Math.round(amount * 100) / 100;
    return payments
      .filter((payment) => payment.paymentStatus === "paid")
      .map((payment) => {
        const refunded = adjustments
          .filter(
            (adjustment) =>
              adjustment.originalPaymentId === payment.id &&
              adjustment.adjustmentType === "refund" &&
              adjustment.direction === "debit",
          )
          .reduce((sum, adjustment) => sum + Number(adjustment.amount), 0);
        const available = Math.max(0, Number(payment.amount) - refunded);
        const allocated = Math.min(available, remaining);
        remaining = Math.max(0, remaining - allocated);
        return allocated > 0
          ? { originalPaymentId: payment.id, amount: allocated.toFixed(2) }
          : null;
      })
      .filter(
        (allocation): allocation is { originalPaymentId: string; amount: string } =>
          allocation !== null,
      );
  }

  function submit() {
    if (selectedItems.length === 0) {
      toast.error("请至少选择一件要退回的商品。");
      return;
    }
    if (reason.trim().length < 3) {
      toast.error("请填写至少 3 个字符的退换货原因。");
      return;
    }
    startTransition(async () => {
      try {
        const result = await posApi.pos.orders.createProductReturn(order.id, {
          idempotencyKey: createId(),
          reason: reason.trim(),
          notes: notes.trim() || undefined,
          items: selectedItems.map(({ item, selection }) => ({
            orderItemId: item.orderItemId,
            quantity: selection.quantity,
            condition: selection.condition,
            disposition: selection.disposition,
          })),
          refundAllocations: buildRefundAllocations(estimatedRefund),
          exchangeItems:
            exchangeItems.length > 0
              ? exchangeItems.map(({ productSkuId, quantity }) => ({
                  productSkuId,
                  quantity,
                }))
              : undefined,
        });
        toast.success(
          result.exchangeOrder
            ? "退货、回库和换货抵扣已完成。"
            : "商品退货与退款记录已完成。",
        );
        setOpen(false);
        if (result.exchangeOrder) {
          router.push(posRoutes.orderDetail(result.exchangeOrder.id));
        } else {
          router.refresh();
        }
      } catch (error) {
        toast.error(getPosApiErrorMessage(error));
      }
    });
  }

  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
          load();
        }}
        type="button"
        variant="outline"
      >
        商品退换货
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>按商品退货 / 换货</DialogTitle>
            <DialogDescription>
              数量按原订单校验；只有选择“回库”的库存商品会增加在手库存。换货会生成关联订单并自动转入退货额度。
            </DialogDescription>
          </DialogHeader>
          {loading || !overview ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              正在读取可退数量…
            </p>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                {overview.returnableItems.map((item) => {
                  const selection = selected[item.orderItemId] ?? {
                    quantity: "0",
                    condition: "good" as const,
                    disposition: item.trackInventory
                      ? ("restock" as const)
                      : ("discarded" as const),
                  };
                  return (
                    <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_105px_125px_125px]" key={item.orderItemId}>
                      <div>
                        <p className="text-sm font-semibold">{item.itemName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          可退 {item.returnableQuantity} / 已购 {item.purchasedQuantity}
                        </p>
                      </div>
                      <Input
                        max={Number(item.returnableQuantity)}
                        min={0}
                        onChange={(event) =>
                          updateSelection(item.orderItemId, {
                            quantity: event.target.value,
                          })
                        }
                        step="0.001"
                        type="number"
                        value={selection.quantity}
                      />
                      <select
                        className="h-10 rounded-md border bg-background px-2 text-sm"
                        onChange={(event) =>
                          updateSelection(item.orderItemId, {
                            condition: event.target.value as PosReturnItemCondition,
                          })
                        }
                        value={selection.condition}
                      >
                        <option value="unopened">未开封</option>
                        <option value="good">完好</option>
                        <option value="damaged">损坏</option>
                        <option value="defective">质量问题</option>
                        <option value="unknown">未知</option>
                      </select>
                      <select
                        className="h-10 rounded-md border bg-background px-2 text-sm"
                        onChange={(event) =>
                          updateSelection(item.orderItemId, {
                            disposition: event.target.value as PosReturnDisposition,
                          })
                        }
                        value={selection.disposition}
                      >
                        {item.trackInventory ? <option value="restock">回库</option> : null}
                        <option value="damaged">损坏区</option>
                        <option value="discarded">报废</option>
                        <option value="exchange">换货留存</option>
                      </select>
                    </div>
                  );
                })}
              </div>

              <section className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">换购商品（可选）</h3>
                  <span className="text-xs text-muted-foreground">
                    退货额度 {formatOrderMoney(estimatedRefund.toFixed(2), order.currency)}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_100px_auto]">
                  <select
                    className="h-10 rounded-md border bg-background px-2 text-sm"
                    onChange={(event) => setExchangeSkuId(event.target.value)}
                    value={exchangeSkuId}
                  >
                    <option value="">选择替换商品</option>
                    {products.map((product) => (
                      <option key={product.productSkuId} value={product.productSkuId}>
                        {product.name} {product.variantName ?? ""} · {product.amount}
                      </option>
                    ))}
                  </select>
                  <Input
                    min={0.001}
                    onChange={(event) => setExchangeQuantity(event.target.value)}
                    step="0.001"
                    type="number"
                    value={exchangeQuantity}
                  />
                  <Button disabled={!exchangeSkuId} onClick={addExchangeItem} type="button" variant="outline">
                    添加
                  </Button>
                </div>
                {exchangeItems.map((item) => (
                  <div className="flex justify-between text-xs" key={item.productSkuId}>
                    <span>{item.name} × {item.quantity}</span>
                    <button
                      className="text-destructive"
                      onClick={() =>
                        setExchangeItems((current) =>
                          current.filter((entry) => entry.productSkuId !== item.productSkuId),
                        )
                      }
                      type="button"
                    >
                      移除
                    </button>
                  </div>
                ))}
              </section>

              <label className="block text-xs font-semibold text-muted-foreground">
                退换货原因
                <Input
                  className="mt-1.5"
                  maxLength={500}
                  onChange={(event) => setReason(event.target.value)}
                  value={reason}
                />
              </label>
              <label className="block text-xs font-semibold text-muted-foreground">
                备注（可选）
                <Input
                  className="mt-1.5"
                  maxLength={2000}
                  onChange={(event) => setNotes(event.target.value)}
                  value={notes}
                />
              </label>
              {overview.data.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  该订单已有 {overview.data.length} 笔已完成退换货记录。
                </p>
              ) : null}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              取消
            </Button>
            <Button disabled={isPending || loading} onClick={submit} type="button">
              {isPending ? "处理中…" : exchangeItems.length ? "确认换货" : "确认退货"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
