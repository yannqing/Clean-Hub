"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { PosCatalogService } from "@cleanhub/api-client";
import { useTranslation } from "@cleanhub/i18n/react";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from "@cleanhub/ui";

import { Icon } from "@/components/app-shell";
import { translatePosText } from "@/components/i18n/pos-runtime-text";

import { ORDER_FILTER_KEYS, type OrderDateFilter } from "../constants";
import { OrderCreateDialog } from "./order-create-dialog";

type OrdersPageHeaderProps = {
  canManageSensitiveOperations?: boolean;
  catalog?: PosCatalogService[];
  defaultBranchId?: string;
};

const DATE_OPTIONS: ReadonlyArray<{
  value: OrderDateFilter;
  label: string;
}> = [
  { value: "all", label: "全部日期" },
  { value: "today", label: "今天" },
  { value: "last_7d", label: "近 7 天" },
  { value: "month", label: "本月" },
];

export function OrdersPageHeader({
  canManageSensitiveOperations = false,
  catalog = [],
  defaultBranchId,
}: OrdersPageHeaderProps) {
  const { locale } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const text = (value: string) => translatePosText(value, locale);
  const date =
    (params.get(ORDER_FILTER_KEYS.date) as OrderDateFilter | null) ?? "all";
  const selectedDate =
    DATE_OPTIONS.find((option) => option.value === date) ?? DATE_OPTIONS[0];

  function changeDate(value: OrderDateFilter) {
    const search = new URLSearchParams(params.toString());
    if (value === "all") {
      search.delete(ORDER_FILTER_KEYS.date);
    } else {
      search.set(ORDER_FILTER_KEYS.date, value);
    }
    search.delete(ORDER_FILTER_KEYS.page);
    startTransition(() => {
      router.replace(`/orders?${search.toString()}`, { scroll: false });
    });
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="flex min-w-0 items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
        <Icon className="size-[19px]" name="receipt" />
        <span className="truncate">{text("订单")}</span>
      </h1>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              className="h-8 gap-1.5 px-2.5 text-xs"
              disabled={isPending}
              size="sm"
              type="button"
              variant="outline"
            >
              <Icon className="size-3.5" name="clock" />
              {text(selectedDate.label)}
              <Icon className="size-3" name="chevron-down" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-44 p-1.5">
            <div className="grid gap-1">
              {DATE_OPTIONS.map((option) => (
                <button
                  aria-pressed={date === option.value}
                  className={cn(
                    "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors hover:bg-accent",
                    date === option.value && "bg-accent",
                  )}
                  key={option.value}
                  onClick={() => changeDate(option.value)}
                  type="button"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "w-3 text-center",
                      date === option.value ? "opacity-100" : "opacity-0",
                    )}
                  >
                    ✓
                  </span>
                  {text(option.label)}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <OrderCreateDialog
          canManageSensitiveOperations={canManageSensitiveOperations}
          catalog={catalog}
          defaultBranchId={defaultBranchId}
          triggerClassName="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        />
      </div>
    </header>
  );
}
