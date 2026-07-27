"use client";

import { useTranslation } from "@cleanhub/i18n/react";

import { Icon, PosBreadcrumb } from "@/components/app-shell";
import { translatePosText } from "@/components/i18n/pos-runtime-text";

export function TicketsPageHeader() {
  const { locale } = useTranslation();
  const text = (value: string) => translatePosText(value, locale);

  return (
    <>
      <PosBreadcrumb className="mb-5" items={[{ label: text("工单管理") }]} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            {text("工单管理")}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {text("查询工单、跟进服务进度并维护工单信息。")}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Icon className="h-4 w-4 text-slate-400" name="alert" />
          {text("本页面仅支持查询，新增工单请在「客户接待」中创建")}
        </div>
      </div>
    </>
  );
}
