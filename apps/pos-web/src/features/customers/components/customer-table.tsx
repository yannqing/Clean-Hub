"use client";

import { CUSTOMER_STAT_PLACEHOLDER } from "../constants";
import type { CustomerListRow } from "../types";
import { CustomerStatusSwitch } from "./customer-status-switch";

type CustomerTableProps = {
  rows: CustomerListRow[];
  accountContext: boolean;
  loading: boolean;
  /** Total matching accounts across all pages. */
  totalAccounts: number;
  /** Total matching profiles across all pages. */
  totalProfiles: number;
  onToggleStatus: (row: CustomerListRow) => void;
  onViewProfiles: (accountId: string) => void;
  onEdit: (row: CustomerListRow) => void;
  onDelete: (row: CustomerListRow) => void;
  onService?: (row: CustomerListRow) => void;
};

const GRID_COLS = "grid-cols-[1.25fr_1.2fr_1.1fr_110px_100px_120px_190px]";

/**
 * Mixed results table. Account rows carry a blue tag and a "view profiles"
 * drill-down; profile rows carry a violet tag. The milestone doc defers
 * tier/balance/orders/last-visit, so those columns render a placeholder.
 */
export function CustomerTable({
  rows,
  accountContext,
  loading,
  totalAccounts,
  totalProfiles,
  onToggleStatus,
  onViewProfiles,
  onEdit,
  onDelete,
  onService,
}: CustomerTableProps) {
  const countLabel = accountContext
    ? ""
    : `账户 ${totalAccounts} 条 · 档案 ${totalProfiles} 条`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 sm:px-5">
        <div>
          <span className="text-sm font-semibold text-slate-900">查询结果</span>
          {countLabel ? (
            <span className="ml-2 text-xs text-slate-500">{countLabel}</span>
          ) : null}
        </div>
        <span className="text-xs text-slate-400">不同结果类型使用标签区分</span>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-slate-500">
          {loading ? "加载中…" : "没有符合当前查询条件的数据。"}
        </div>
      ) : (
        <>
          <div className="divide-y divide-slate-100 min-[1400px]:hidden">
            {rows.map((row) => (
              <CustomerCard
                key={`${row.kind}-${row.id}`}
                onDelete={() => onDelete(row)}
                onEdit={() => onEdit(row)}
                onService={
                  row.kind === "profile" && onService
                    ? () => onService(row)
                    : undefined
                }
                onToggleStatus={() => onToggleStatus(row)}
                onViewProfiles={
                  row.kind === "account"
                    ? () => onViewProfiles(row.id)
                    : undefined
                }
                row={row}
              />
            ))}
          </div>

          <div className="hidden overflow-x-auto min-[1400px]:block">
            <div className="min-w-[1040px]">
              <div
                className={`grid ${GRID_COLS} bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400`}
              >
                <div>类型及名称</div>
                <div>联系方式</div>
                <div>{accountContext ? "档案信息" : "关联信息"}</div>
                <div>关系/来源</div>
                <div>状态</div>
                <div className="text-center">最近记录</div>
                <div className="text-right">操作</div>
              </div>

              {rows.map((row) =>
                row.kind === "account" ? (
                  <AccountRow
                    key={`account-${row.id}`}
                    row={row}
                    onToggleStatus={() => onToggleStatus(row)}
                    onViewProfiles={() => onViewProfiles(row.id)}
                    onEdit={() => onEdit(row)}
                    onDelete={() => onDelete(row)}
                  />
                ) : (
                  <ProfileRow
                    key={`profile-${row.id}`}
                    row={row}
                    onToggleStatus={() => onToggleStatus(row)}
                    onEdit={() => onEdit(row)}
                    onDelete={() => onDelete(row)}
                    onService={onService ? () => onService(row) : undefined}
                  />
                ),
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CustomerCard({
  row,
  onToggleStatus,
  onViewProfiles,
  onService,
  onEdit,
  onDelete,
}: {
  row: CustomerListRow;
  onToggleStatus: () => void;
  onViewProfiles?: () => void;
  onService?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isAccount = row.kind === "account";
  const name = isAccount ? row.accountName : row.fullName;

  return (
    <article className={`p-4 sm:p-5 ${isAccount ? "bg-blue-50/20" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                isAccount
                  ? "bg-blue-50 text-blue-700"
                  : "bg-violet-50 text-violet-700"
              }`}
            >
              {isAccount ? "账户" : "档案"}
            </span>
            <span className="truncate text-base font-semibold text-slate-950">
              {name}
            </span>
          </div>
          <div className="mt-2 text-sm text-slate-700">
            {row.phone || "未填写手机号"}
          </div>
          <div className="mt-0.5 truncate text-xs text-slate-500">
            {row.email || "未填写邮箱"}
          </div>
          {!isAccount ? (
            <div className="mt-1 text-xs text-slate-500">
              所属账户：{row.accountName || "-"}
            </div>
          ) : (
            <div className="mt-1 font-mono text-[11px] text-slate-400">
              {row.id}
            </div>
          )}
        </div>
        <CustomerStatusSwitch
          kind={row.kind}
          status={row.status}
          onToggle={onToggleStatus}
        />
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        {isAccount && onViewProfiles ? (
          <button
            className="h-11 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700"
            onClick={onViewProfiles}
            type="button"
          >
            查看档案
          </button>
        ) : null}
        {!isAccount && onService ? (
          <button
            className="h-11 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700"
            onClick={onService}
            type="button"
          >
            客户服务
          </button>
        ) : null}
        <button
          className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
          onClick={onEdit}
          type="button"
        >
          编辑
        </button>
        <button
          className="h-11 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-600"
          onClick={onDelete}
          type="button"
        >
          删除
        </button>
      </div>
    </article>
  );
}

type AccountRowProps = {
  row: Extract<CustomerListRow, { kind: "account" }>;
  onToggleStatus: () => void;
  onViewProfiles: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function AccountRow({
  row,
  onToggleStatus,
  onViewProfiles,
  onEdit,
  onDelete,
}: AccountRowProps) {
  return (
    <div
      className={`grid ${GRID_COLS} items-center border-t border-slate-100 bg-blue-50/20 px-5 py-4 text-sm hover:bg-blue-50/50`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
            账户
          </span>
          <button
            className="truncate font-semibold text-blue-700 hover:underline"
            type="button"
            onClick={onViewProfiles}
          >
            {row.accountName}
          </button>
        </div>
        <div className="mt-1 font-mono text-[11px] text-slate-400">
          {row.id}
        </div>
      </div>
      <div className="min-w-0">
        <div className="truncate text-slate-700">
          {row.phone || "未填写手机号"}
        </div>
        <div className="truncate text-xs text-slate-500">
          {row.email || "未填写邮箱"}
        </div>
      </div>
      <div>
        <button
          className="font-semibold text-blue-700"
          type="button"
          onClick={onViewProfiles}
        >
          查看档案
        </button>
      </div>
      <div className="text-slate-600">{CUSTOMER_STAT_PLACEHOLDER}</div>
      <div>
        <CustomerStatusSwitch
          kind="account"
          status={row.status}
          onToggle={onToggleStatus}
        />
      </div>
      <div className="text-center text-slate-500">
        {CUSTOMER_STAT_PLACEHOLDER}
      </div>
      <div className="flex justify-end gap-2">
        <button
          className="text-xs font-semibold text-blue-700"
          type="button"
          onClick={onViewProfiles}
        >
          查看档案
        </button>
        <button
          className="text-xs font-semibold text-slate-600"
          type="button"
          onClick={onEdit}
        >
          编辑
        </button>
        <button
          className="text-xs font-semibold text-red-600"
          type="button"
          onClick={onDelete}
        >
          删除
        </button>
      </div>
    </div>
  );
}

type ProfileRowProps = {
  row: Extract<CustomerListRow, { kind: "profile" }>;
  onToggleStatus: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onService?: () => void;
};

function ProfileRow({
  row,
  onToggleStatus,
  onEdit,
  onDelete,
  onService,
}: ProfileRowProps) {
  return (
    <div
      className={`grid ${GRID_COLS} items-center border-t border-slate-100 px-5 py-4 text-sm hover:bg-slate-50/70`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700">
            档案
          </span>
          <button
            className="truncate font-semibold text-slate-900 hover:text-blue-700 hover:underline"
            type="button"
            onClick={onService}
          >
            {row.fullName}
          </button>
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {CUSTOMER_STAT_PLACEHOLDER} · 余额 {CUSTOMER_STAT_PLACEHOLDER}
        </div>
      </div>
      <div className="min-w-0">
        <div className="truncate text-slate-700">
          {row.phone || "未填写手机号"}
        </div>
        <div className="truncate text-xs text-slate-500">
          {row.email || "未填写邮箱"}
        </div>
      </div>
      <div className="truncate text-slate-700">
        所属账户：{row.accountName || "-"}
      </div>
      <div className="text-slate-600">{CUSTOMER_STAT_PLACEHOLDER}</div>
      <div>
        <CustomerStatusSwitch
          kind="profile"
          status={row.status}
          onToggle={onToggleStatus}
        />
      </div>
      <div className="text-center text-slate-500">
        {CUSTOMER_STAT_PLACEHOLDER}
      </div>
      <div className="flex justify-end gap-3">
        {onService ? (
          <button
            className="text-xs font-semibold text-blue-700"
            type="button"
            onClick={onService}
          >
            客户服务
          </button>
        ) : null}
        <button
          className="text-xs font-semibold text-slate-600"
          type="button"
          onClick={onEdit}
        >
          编辑
        </button>
        <button
          className="text-xs font-semibold text-red-600"
          type="button"
          onClick={onDelete}
        >
          删除
        </button>
      </div>
    </div>
  );
}
