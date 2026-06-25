"use client";

import { CUSTOMER_STAT_PLACEHOLDER } from "../constants";
import type { CustomerListRow } from "../types";
import { CustomerStatusSwitch } from "./customer-status-switch";

type CustomerTableProps = {
  rows: CustomerListRow[];
  accountContext: boolean;
  loading: boolean;
  onToggleStatus: (row: CustomerListRow) => void;
  onViewProfiles: (accountId: string) => void;
  onEdit: (row: CustomerListRow) => void;
  onDelete: (row: CustomerListRow) => void;
  onService?: (row: CustomerListRow) => void;
};

const GRID_COLS =
  "grid-cols-[1.25fr_1.2fr_1.1fr_110px_100px_120px_190px]";

/**
 * Mixed results table. Account rows carry a blue tag and a "view profiles"
 * drill-down; profile rows carry a violet tag. The milestone doc defers
 * tier/balance/orders/last-visit, so those columns render a placeholder.
 */
export function CustomerTable({
  rows,
  accountContext,
  loading,
  onToggleStatus,
  onViewProfiles,
  onEdit,
  onDelete,
  onService,
}: CustomerTableProps) {
  const countLabel = accountContext
    ? ""
    : `账户 ${rows.filter((row) => row.kind === "account").length} 条 · 档案 ${rows.filter((row) => row.kind === "profile").length} 条`;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1040px]">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <span className="text-sm font-semibold text-slate-900">查询结果</span>
            {countLabel ? (
              <span className="ml-2 text-xs text-slate-500">{countLabel}</span>
            ) : null}
          </div>
          <span className="text-xs text-slate-400">不同结果类型使用标签区分</span>
        </div>
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

        {rows.length === 0 ? (
          <div className="border-t border-slate-100 px-5 py-12 text-center text-sm text-slate-500">
            {loading ? "加载中…" : "没有符合当前查询条件的数据。"}
          </div>
        ) : (
          rows.map((row) =>
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
          )
        )}
      </div>
    </div>
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
        <div className="mt-1 font-mono text-[11px] text-slate-400">{row.id}</div>
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
      <div className="text-center text-slate-500">{CUSTOMER_STAT_PLACEHOLDER}</div>
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
          <span className="truncate font-semibold text-slate-900">
            {row.fullName}
          </span>
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
      <div className="text-center text-slate-500">{CUSTOMER_STAT_PLACEHOLDER}</div>
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
