"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Icon,
  cn,
} from "@cleanhub/ui";
import {
  BadgePercent,
  Gift,
  Plus,
  ReceiptText,
  Truck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { useTenantI18n } from "@/i18n";

import type { DiscountType } from "../types";

type DiscountTypePickerProps = {
  canManage: boolean;
  mode?: "dialog" | "page";
};

export function DiscountTypePicker({
  canManage,
  mode = "dialog",
}: DiscountTypePickerProps) {
  const { m } = useTenantI18n();
  const [open, setOpen] = useState(mode === "page");
  const options: Array<{
    description: string;
    icon: LucideIcon;
    type: DiscountType;
  }> = [
    {
      type: "amount_off_items",
      icon: BadgePercent,
      description: m.discounts.typePicker.amountOffItemsDescription,
    },
    {
      type: "amount_off_order",
      icon: ReceiptText,
      description: m.discounts.typePicker.amountOffOrderDescription,
    },
    {
      type: "buy_x_get_y",
      icon: Gift,
      description: m.discounts.typePicker.buyXGetYDescription,
    },
    {
      type: "free_shipping",
      icon: Truck,
      description: m.discounts.typePicker.freeShippingDescription,
    },
  ];

  const choices = (
    <div className="grid gap-2">
      {options.map((option) => {
        const content = (
          <>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:text-foreground">
              <Icon aria-hidden icon={option.icon} size={16} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">
                {m.discounts.types[option.type]}
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {option.description}
              </span>
            </span>
          </>
        );

        return canManage ? (
          <Link
            className="group flex items-start gap-3 rounded-lg border p-3.5 transition-colors hover:bg-muted/50"
            href={`${webAdminRoutes.tenant.newDiscount}?type=${option.type}`}
            key={option.type}
          >
            {content}
          </Link>
        ) : (
          <div
            aria-disabled="true"
            className="flex items-start gap-3 rounded-lg border p-3.5 opacity-55"
            key={option.type}
          >
            {content}
          </div>
        );
      })}
    </div>
  );

  if (mode === "page") {
    return (
      <section className="mx-auto w-full max-w-2xl space-y-4 py-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {m.discounts.typePicker.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {m.discounts.typePicker.description}
          </p>
        </div>
        {choices}
      </section>
    );
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Button
        disabled={!canManage}
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
      >
        <Icon aria-hidden icon={Plus} size={14} />
        {m.discounts.createAction}
      </Button>
      <DialogContent className={cn("sm:max-w-xl")}>
        <DialogHeader>
          <DialogTitle>{m.discounts.typePicker.title}</DialogTitle>
          <DialogDescription>
            {m.discounts.typePicker.description}
          </DialogDescription>
        </DialogHeader>
        {choices}
      </DialogContent>
    </Dialog>
  );
}
