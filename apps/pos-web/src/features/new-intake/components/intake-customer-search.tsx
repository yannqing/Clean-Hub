"use client";

import { useTranslation } from "@cleanhub/i18n/react";

import { translatePosText } from "@/components/i18n/pos-runtime-text";
import { Icon } from "@/components/app-shell";

type IntakeCustomerSearchProps = {
  draftQuery: string;
  onDraftQueryChange: (value: string) => void;
  onSearch: () => void;
};

export function IntakeCustomerSearch({
  draftQuery,
  onDraftQueryChange,
  onSearch,
}: IntakeCustomerSearchProps) {
  const { locale } = useTranslation();
  const text = (value: string) => translatePosText(value, locale);

  return (
    <div className="border-b border-slate-200 p-4">
      <div className="flex gap-3">
        <div className="flex h-12 min-w-0 flex-1 items-center rounded-lg border border-slate-200 bg-white px-3 transition focus-within:border-slate-400">
          <Icon className="mr-2.5 h-[18px] w-[18px] text-slate-400" name="search" />
          <input
            className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
            onChange={(event) => onDraftQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSearch();
              }
            }}
            placeholder={text("输入账户或档案手机号 / 邮箱")}
            value={draftQuery}
          />
          <button
            className="h-11 rounded-md bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
            type="button"
            onClick={onSearch}
          >
            {text("查询")}
          </button>
        </div>
      </div>
    </div>
  );
}
