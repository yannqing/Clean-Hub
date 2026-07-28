"use client";

import type { PosCatalogService } from "@cleanhub/api-client";
import { useTranslation } from "@cleanhub/i18n/react";

import { Icon, PosBreadcrumb } from "@/components/app-shell";
import { translatePosText } from "@/components/i18n/pos-runtime-text";

import { OrderCreateDialog } from "./order-create-dialog";

type OrdersPageHeaderProps = {
  canManageSensitiveOperations?: boolean;
  catalog?: PosCatalogService[];
  defaultBranchId?: string;
};

export function OrdersPageHeader({
  canManageSensitiveOperations = false,
  catalog = [],
  defaultBranchId,
}: OrdersPageHeaderProps) {
  const { locale } = useTranslation();
  const text = (value: string) => translatePosText(value, locale);

  return (
    <>
      <PosBreadcrumb className="mb-3" items={[{ label: text("订单管理") }]} />

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white">
            <Icon className="h-[18px] w-[18px]" name="receipt" />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-950">
              {text("订单管理")}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {text("查询门店订单、查看支付状态并处理现金收款。")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Icon className="h-4 w-4 text-slate-400" name="wallet-cards" />
            {text("本期仅开放现金收款")}
          </div>
          <OrderCreateDialog
            canManageSensitiveOperations={canManageSensitiveOperations}
            catalog={catalog}
            defaultBranchId={defaultBranchId}
          />
        </div>
      </div>
    </>
  );
}
