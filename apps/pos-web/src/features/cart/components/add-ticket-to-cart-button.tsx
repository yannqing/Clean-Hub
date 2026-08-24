"use client";

import type {
  RelatedOrderSummary,
  ServiceTicketDetail,
} from "@cleanhub/api-client";
import { useTranslation } from "@cleanhub/i18n/react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn,
} from "@cleanhub/ui";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Icon } from "@/components/app-shell";
import { posRoutes } from "@/config";
import { formatPosMoney } from "@/lib/money";
import { posToast as toast } from "@/lib/pos-toast";

import { getTicketItemAvailability, usePosCart } from "../lib";

export function AddTicketToCartButton({
  relatedOrders,
  ticket,
}: {
  relatedOrders: RelatedOrderSummary[];
  ticket: ServiceTicketDetail;
}) {
  const { locale, t } = useTranslation();
  const router = useRouter();
  const { addTicket, cart, loaded } = usePosCart();
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { billedIds, cartIds } = useMemo(
    () => getTicketItemAvailability(ticket.id, relatedOrders, cart),
    [cart, relatedOrders, ticket.id],
  );
  const availableItems = ticket.items.filter(
    (item) => !billedIds.has(item.id) && !cartIds.has(item.id),
  );
  const selectedItems = availableItems.filter((item) =>
    selectedIds.has(item.id),
  );
  const selectedAmount = selectedItems.reduce(
    (total, item) => total + Number(item.lineAmount),
    0,
  );
  const unavailable =
    !loaded ||
    ticket.items.length === 0 ||
    ticket.ticketStatus === "cancelled" ||
    availableItems.length === 0;

  function openSelector() {
    setSelectedIds(new Set(availableItems.map((item) => item.id)));
    setOpen(true);
  }

  function addSelectedItems() {
    const result = addTicket({ ...ticket, items: selectedItems });
    if (!result.changed) {
      toast.error(result.message ?? t("pos.cart.unavailable"));
      return;
    }
    setOpen(false);
    router.push(posRoutes.sale);
  }

  return (
    <>
      <button
        className="flex h-11 items-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={unavailable}
        onClick={openSelector}
        type="button"
      >
        <Icon className="size-4" name="shopping-cart" />
        {availableItems.length > 0
          ? t("pos.cart.addProduct")
          : t("pos.cart.allBilled")}
      </button>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-h-[88dvh] overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="border-b px-5 py-4 text-left">
            <DialogTitle>{t("pos.cart.selectTicketItems")}</DialogTitle>
            <DialogDescription>
              {t("pos.cart.ticketItemsDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
            <span className="text-xs font-medium text-muted-foreground">
              {t("pos.cart.selectedCount", {
                available: availableItems.length,
                selected: selectedItems.length,
              })}
            </span>
            <button
              className="text-xs font-semibold text-foreground hover:underline"
              onClick={() =>
                setSelectedIds(
                  selectedItems.length === availableItems.length
                    ? new Set()
                    : new Set(availableItems.map((item) => item.id)),
                )
              }
              type="button"
            >
              {selectedItems.length === availableItems.length
                ? t("pos.cart.clearSelection")
                : t("pos.cart.selectAll")}
            </button>
          </div>

          <div className="min-h-0 max-h-[52dvh] divide-y overflow-y-auto">
            {ticket.items.map((item) => {
              const billed = billedIds.has(item.id);
              const inCart = cartIds.has(item.id);
              const disabled = billed || inCart;
              const checked = selectedIds.has(item.id) && !disabled;
              return (
                <label
                  className={cn(
                    "flex gap-3 px-5 py-3.5",
                    disabled
                      ? "cursor-not-allowed bg-muted/35 opacity-65"
                      : "cursor-pointer hover:bg-muted/30",
                  )}
                  key={item.id}
                >
                  <input
                    checked={checked}
                    className="mt-1 size-4 shrink-0 accent-foreground"
                    disabled={disabled}
                    onChange={(event) => {
                      const next = new Set(selectedIds);
                      if (event.target.checked) next.add(item.id);
                      else next.delete(item.id);
                      setSelectedIds(next);
                    }}
                    type="checkbox"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {item.itemName}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {item.pricingUnit === "per_kg"
                            ? `${item.weight ?? "0"} kg${item.bagCount ? ` · ${item.bagCount} bags` : ""}`
                            : `${item.quantity} × ${formatPosMoney(item.chargedUnitAmount, ticket.currency, locale)}`}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-foreground">
                        {formatPosMoney(
                          item.lineAmount,
                          ticket.currency,
                          locale,
                        )}
                      </span>
                    </span>
                    {billed || inCart ? (
                      <span className="mt-2 inline-flex rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                        {billed
                          ? t("pos.cart.alreadyBilled")
                          : t("pos.cart.alreadyInCart")}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t bg-muted/25 px-5 py-3">
            <span className="text-sm text-muted-foreground">
              {t("pos.cart.billableAmount")}
            </span>
            <span className="text-lg font-bold text-foreground">
              {formatPosMoney(selectedAmount, ticket.currency, locale)}
            </span>
          </div>
          <DialogFooter className="border-t px-5 py-4">
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              {t("common.cancel")}
            </Button>
            <Button
              className="gap-2"
              disabled={selectedItems.length === 0}
              onClick={addSelectedItems}
              type="button"
            >
              <Icon className="size-4" name="shopping-cart" />
              {t("pos.cart.addSelected")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
