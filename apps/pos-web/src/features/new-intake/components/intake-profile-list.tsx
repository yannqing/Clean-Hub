"use client";

import type { SupportedLocale } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";

import { translatePosText } from "@/components/i18n/pos-runtime-text";
import { Icon } from "@/components/app-shell";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { formatPosMoney } from "@/lib/money";
import { buildPaginationWindow } from "@/lib/pagination";

import type {
  IntakeAccountRow,
  IntakeLookupRow,
  IntakeProfileRow,
} from "../types";

type IntakeProfileListProps = {
  rows: IntakeLookupRow[];
  loading: boolean;
  hasSearched: boolean;
  mode: "search" | "accountProfiles";
  account: {
    accountName: string;
    phone: string | null;
    email: string | null;
  } | null;
  filterText: string;
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  pageSizeOptions: readonly number[];
  onFilterTextChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onBackToSearchResults: () => void;
  onCreateCustomer: () => void;
  onCreateProfile: () => void;
  onSelectAccount: (row: IntakeAccountRow) => void;
  onSelect: (row: IntakeProfileRow) => void;
};

const GRID_COLS =
  "grid-cols-[minmax(240px,1.25fr)_minmax(180px,1fr)_minmax(220px,1.15fr)_130px_110px]";

export function IntakeProfileList({
  rows,
  loading,
  hasSearched,
  mode,
  account,
  filterText,
  page,
  pageSize,
  total,
  pageCount,
  pageSizeOptions,
  onFilterTextChange,
  onPageChange,
  onPageSizeChange,
  onBackToSearchResults,
  onCreateCustomer,
  onCreateProfile,
  onSelectAccount,
  onSelect,
}: IntakeProfileListProps) {
  const { locale } = useTranslation();
  const text = (value: string) => translatePosText(value, locale);
  const { currency } = usePosRuntimeConfig();
  const isAccountMode = mode === "accountProfiles";
  const pages = buildPaginationWindow(page, pageCount);

  if (rows.length === 0 && loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center px-6 text-sm text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (rows.length === 0) {
    const title = isAccountMode
      ? "该账户暂无档案"
      : hasSearched
        ? "未找到客户"
        : "输入客户信息开始查询";
    const description = isAccountMode
      ? "当前账户还没有客户档案。可以为该账户创建第一个接待档案。"
      : hasSearched
        ? "没有账户或档案联系方式匹配当前查询。请先创建客户账户，再添加第一个档案。"
        : "默认不会展示客户资料。请输入手机号、邮箱或姓名，系统会匹配客户账户与档案联系方式。";

    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" name="search" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-foreground">
          {text(title)}
        </h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {text(description)}
        </p>
        {isAccountMode ? (
          <div className="mt-5 flex items-center gap-2">
            <button
              className="h-10 rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition hover:bg-muted/50"
              type="button"
              onClick={onBackToSearchResults}
            >
              返回搜索结果
            </button>
            <button
              className="h-10 rounded-lg bg-foreground px-4 text-sm font-semibold text-background"
              type="button"
              onClick={onCreateProfile}
            >
              新建档案
            </button>
          </div>
        ) : (
          <button
            className="mt-5 h-10 rounded-lg bg-foreground px-4 text-sm font-semibold text-background"
            type="button"
            onClick={onCreateCustomer}
          >
            新建客户
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/50 px-5 py-3">
        <div>
          <div className="text-sm font-semibold text-foreground">
            {isAccountMode ? (
              <RawText
                value={formatAccountProfileCount(
                  account?.accountName ?? text("客户账户"),
                  total,
                  locale,
                )}
              />
            ) : (
              `${total} 条匹配结果`
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {isAccountMode ? (
              <RawText
                value={
                  [account?.phone, account?.email]
                    .filter(Boolean)
                    .join(" / ") || text("账户下的客户档案")
                }
              />
            ) : (
              "点击账户查看其档案列表，点击档案进入客户详情"
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAccountMode ? (
            <button
              className="h-11 rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition hover:bg-muted/50"
              type="button"
              onClick={onBackToSearchResults}
            >
              返回搜索结果
            </button>
          ) : null}
          <div className="flex h-11 w-full items-center rounded-lg border border-border bg-background px-3 sm:w-[260px]">
            <Icon
              className="mr-2 h-4 w-4 text-muted-foreground"
              name="search"
            />
            <input
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onChange={(event) => onFilterTextChange(event.target.value)}
              placeholder={
                isAccountMode ? "在该账户档案中筛选" : "在结果中筛选账户或档案"
              }
              value={filterText}
            />
          </div>
          {isAccountMode ? (
            <button
              className="flex h-11 items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-muted"
              type="button"
              onClick={onCreateProfile}
            >
              <span className="text-base leading-none">+</span>
              新建档案
            </button>
          ) : null}
        </div>
      </div>

      <div className="divide-y divide-border/60 min-[1180px]:hidden">
        {rows.map((row) => (
          <IntakeResultCard
            key={`${row.kind}-${row.id}`}
            locale={locale}
            onSelect={() =>
              row.kind === "account" ? onSelectAccount(row) : onSelect(row)
            }
            row={row}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto min-[1180px]:block">
        <div className="min-w-[900px]">
          <div
            className={`grid ${GRID_COLS} bg-background px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground`}
          >
            <div>账户/档案</div>
            <div>客户账户</div>
            <div>联系方式</div>
            <div>创建时间</div>
            <div className="text-right">余额</div>
          </div>

          {rows.map((row) =>
            row.kind === "account" ? (
              <button
                className={`grid w-full ${GRID_COLS} items-center border-t border-border/60 px-5 py-3.5 text-left text-sm transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                key={`account-${row.id}`}
                type="button"
                onClick={() => onSelectAccount(row)}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-foreground/85 text-xs font-bold text-background">
                    <RawText value={initials(row.accountName)} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-foreground">
                      <RawText value={row.accountName} />
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>客户账户</span>
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700">
                        查看档案
                      </span>
                    </div>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="truncate font-medium text-foreground">
                    <RawText value={row.accountName} />
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {row.status === "disabled" ? "已停用" : "账户有效"}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="truncate text-foreground">
                    <RawText value={row.phone || text("未填写账户手机号")} />
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    <RawText value={row.email || text("未填写账户邮箱")} />
                  </div>
                </div>

                <div className="text-muted-foreground">
                  {formatDisplayDate(row.createdAt, locale)}
                </div>

                <div className="text-right font-semibold text-muted-foreground">
                  —
                </div>
              </button>
            ) : (
              <button
                className={`grid w-full ${GRID_COLS} items-center border-t border-border/60 px-5 py-3.5 text-left text-sm transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                key={`profile-${row.id}`}
                type="button"
                onClick={() => onSelect(row)}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-foreground text-xs font-bold text-background">
                    <RawText value={initials(row.fullName)} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-foreground">
                      <RawText value={row.fullName} />
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{profileRelation(row)}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                        {profileTier(row)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="truncate font-medium text-foreground">
                    {row.accountName ? (
                      <RawText value={row.accountName} />
                    ) : (
                      "未关联账户"
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {row.status === "disabled" ? "档案已停用" : "档案有效"}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="truncate text-foreground">
                    <RawText value={row.phone || text("未填写档案手机号")} />
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    <RawText value={row.email || text("未填写档案邮箱")} />
                  </div>
                </div>

                <div className="text-muted-foreground">
                  {formatDisplayDate(row.createdAt, locale)}
                </div>

                <div className="text-right font-semibold text-foreground">
                  {formatPosMoney(0, currency, locale)}
                </div>
              </button>
            ),
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-end gap-1">
          <select
            className="mr-2 h-11 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground"
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
            className="h-11 rounded-lg border border-border px-4 text-sm font-semibold text-muted-foreground disabled:opacity-40"
            disabled={page === 1}
            type="button"
            onClick={() => onPageChange(page - 1)}
          >
            上一页
          </button>
          {pages.map((entry, index) =>
            entry === "..." ? (
              <span
                className="px-1.5 text-muted-foreground"
                key={`gap-${index}`}
              >
                …
              </span>
            ) : (
              <button
                className={`h-11 min-w-11 rounded-lg text-sm font-semibold ${
                  entry === page
                    ? "bg-foreground text-background"
                    : "border border-border text-muted-foreground hover:bg-muted/50"
                }`}
                key={entry}
                type="button"
                onClick={() => onPageChange(entry)}
              >
                {entry}
              </button>
            ),
          )}
          <button
            className="h-11 rounded-lg border border-border px-4 text-sm font-semibold text-muted-foreground disabled:opacity-40"
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

function IntakeResultCard({
  row,
  locale,
  onSelect,
}: {
  row: IntakeLookupRow;
  locale: SupportedLocale;
  onSelect: () => void;
}) {
  const isAccount = row.kind === "account";
  const name = isAccount ? row.accountName : row.fullName;
  const text = (value: string) => translatePosText(value, locale);

  return (
    <button
      className="w-full p-4 text-left transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-5"
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-background ${
            isAccount ? "bg-foreground/85" : "bg-foreground"
          }`}
        >
          <RawText value={initials(name)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-semibold text-foreground">
              <RawText value={name} />
            </span>
            <span
              className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                isAccount
                  ? "bg-amber-50 text-amber-700"
                  : "bg-violet-50 text-violet-700"
              }`}
            >
              {isAccount ? "客户账户" : "客户档案"}
            </span>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            <RawText value={row.phone || text("未填写手机号")} />
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            <RawText value={row.email || text("未填写邮箱")} />
          </div>
        </div>
        <span className="shrink-0 rounded-lg bg-muted px-3 py-2 text-xs font-semibold text-foreground">
          {isAccount ? "查看档案" : "进入详情"}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">所属账户</dt>
          <dd className="mt-1 truncate text-sm font-medium text-foreground">
            <RawText
              value={
                isAccount
                  ? row.accountName
                  : row.accountName || text("未关联账户")
              }
            />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">状态</dt>
          <dd className="mt-1 text-sm font-medium text-foreground">
            {row.status === "disabled" ? "已停用" : "正常"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">创建时间</dt>
          <dd className="mt-1 text-sm font-medium text-foreground">
            {formatDisplayDate(row.createdAt, locale)}
          </dd>
        </div>
      </dl>
    </button>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  return (parts[0]?.slice(0, 2) || "?").toUpperCase();
}

function RawText({ value }: { value: string }) {
  return value;
}

function formatAccountProfileCount(
  accountName: string,
  count: number,
  locale: SupportedLocale,
): string {
  if (locale === "en") {
    return `${accountName} · ${count} ${count === 1 ? "profile" : "profiles"}`;
  }
  if (locale === "fr") {
    return `${accountName} · ${count} ${count === 1 ? "profil" : "profils"}`;
  }
  return `${accountName} · ${count} 个档案`;
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

function formatDisplayDate(value: string, locale: SupportedLocale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}
