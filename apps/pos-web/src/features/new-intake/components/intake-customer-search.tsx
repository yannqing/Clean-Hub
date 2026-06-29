"use client";

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
  return (
    <div className="border-b border-slate-200 p-5">
      <div className="flex gap-3">
        <div className="flex h-12 min-w-0 flex-1 items-center rounded-lg border border-blue-200 bg-blue-50/50 px-3 transition focus-within:border-blue-400 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(37,99,235,0.10)]">
          <span className="mr-2.5 text-lg leading-none text-blue-500">⌕</span>
          <input
            className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
            onChange={(event) => onDraftQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSearch();
              }
            }}
            placeholder="输入账户或档案手机号 / 邮箱"
            value={draftQuery}
          />
          <button
            className="h-9 rounded-md bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700"
            type="button"
            onClick={onSearch}
          >
            查询
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <span>示例：</span>
        <button
          className="font-semibold text-blue-700"
          type="button"
          onClick={() => onDraftQueryChange("+221 77 000 0000")}
        >
          共享账户手机号
        </button>
        <span>·</span>
        <button
          className="font-semibold text-blue-700"
          type="button"
          onClick={() => onDraftQueryChange("mamadou.diop@example.com")}
        >
          档案邮箱兜底查询
        </button>
      </div>
    </div>
  );
}
