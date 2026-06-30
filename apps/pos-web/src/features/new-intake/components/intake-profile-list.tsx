"use client";

import type { IntakeProfileRow } from "../types";

type IntakeProfileListProps = {
  rows: IntakeProfileRow[];
  loading: boolean;
  filterText: string;
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  pageSizeOptions: readonly number[];
  onFilterTextChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onCreateProfile: () => void;
  onSelect: (row: IntakeProfileRow) => void;
};

const GRID_COLS =
  "grid-cols-[minmax(220px,1.2fr)_minmax(170px,1fr)_minmax(220px,1.2fr)_120px_130px_90px]";

export function IntakeProfileList({
  rows,
  loading,
  filterText,
  page,
  pageSize,
  total,
  pageCount,
  pageSizeOptions,
  onFilterTextChange,
  onPageChange,
  onPageSizeChange,
  onCreateProfile,
  onSelect,
}: IntakeProfileListProps) {
  if (rows.length === 0 && loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center px-6 text-sm text-slate-500">
        加载中...
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
          ⌕
        </div>
        <h2 className="mt-4 text-base font-semibold text-slate-950">
          未找到客户档案
        </h2>
        <p className="mt-1 max-w-md text-sm text-slate-500">
          没有账户或档案联系方式匹配当前查询。请先创建客户账户，再添加第一个档案。
        </p>
        <button
          className="mt-5 h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white"
          type="button"
          onClick={onCreateProfile}
        >
          新建客户
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            {total} 个客户档案
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            已匹配客户账户联系方式，正在展示该账户下的全部档案
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 w-[260px] items-center rounded-lg border border-slate-200 bg-white px-3">
            <span className="mr-2 text-slate-400">⌕</span>
            <input
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              onChange={(event) => onFilterTextChange(event.target.value)}
              placeholder="在结果中筛选档案"
              value={filterText}
            />
          </div>
          <button
            className="flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            type="button"
            onClick={onCreateProfile}
          >
            <span className="text-base leading-none">+</span>
            新建档案
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div
            className={`grid ${GRID_COLS} bg-white px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400`}
          >
            <div>客户档案</div>
            <div>客户账户</div>
            <div>档案联系方式</div>
            <div>最近到店</div>
            <div className="text-right">余额</div>
            <div />
          </div>

          {rows.map((row) => (
            <div
              className={`grid ${GRID_COLS} items-center border-t border-slate-100 px-5 py-3.5 text-sm transition hover:bg-blue-50/30`}
              key={row.id}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 via-blue-500 to-violet-500 text-xs font-bold text-white">
                  {initials(row.fullName)}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-950">
                    {row.fullName}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                    <span>{profileRelation(row)}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium">
                      {profileTier(row)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="min-w-0">
                <div className="truncate font-medium text-slate-700">
                  {row.accountName || "未关联账户"}
                </div>
                <div className="truncate text-xs text-slate-400">
                  {row.phone || "未填写账户手机号"}
                </div>
              </div>

              <div className="min-w-0">
                <div className="truncate text-slate-700">
                  {row.phone || "未填写档案手机号"}
                </div>
                <div className="truncate text-xs text-slate-500">
                  {row.email || "未填写档案邮箱"}
                </div>
              </div>

              <div className="text-slate-500">
                {formatDisplayDate(row.createdAt)}
              </div>

              <div className="text-right font-semibold text-slate-950">
                XOF 0
              </div>

              <div className="text-right">
                <button
                  className="h-9 rounded-lg bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                  type="button"
                  onClick={() => onSelect(row)}
                >
                  选择
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end border-t border-slate-200 px-5 py-4">
        <div className="flex items-center gap-1">
          <select
            className="mr-2 h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600"
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            value={pageSize}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                每页 {size} 条
              </option>
            ))}
          </select>
          <button
            className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 disabled:opacity-40"
            disabled={page === 1}
            type="button"
            onClick={() => onPageChange(page - 1)}
          >
            上一页
          </button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map(
            (pageNumber) => (
              <button
                className={`h-9 min-w-9 rounded-lg text-sm font-semibold ${
                  pageNumber === page
                    ? "bg-blue-600 text-white"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
                key={pageNumber}
                type="button"
                onClick={() => onPageChange(pageNumber)}
              >
                {pageNumber}
              </button>
            ),
          )}
          <button
            className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 disabled:opacity-40"
            disabled={page === pageCount}
            type="button"
            onClick={() => onPageChange(page + 1)}
          >
            下一页
          </button>
        </div>
      </div>
    </>
  );
}

function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  return (parts[0]?.slice(0, 2) || "?").toUpperCase();
}

function profileRelation(row: IntakeProfileRow): string {
  const name = row.fullName.toLowerCase();
  if (name.includes("household") || name.includes("共享")) return "共享档案";
  if (name.includes("company") || name.includes("企业")) return "企业员工";
  return "家庭成员";
}

function profileTier(row: IntakeProfileRow): string {
  const name = row.fullName.toLowerCase();
  if (name.includes("household") || name.includes("共享")) return "共享档案";
  if (name.includes("company") || name.includes("企业")) return "企业客户";
  return "普通客户";
}

function formatDisplayDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}
