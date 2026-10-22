"use client";

import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
import { useTranslation } from "@cleanhub/i18n/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cleanhub/ui";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { getCustomerColumnLabel } from "@/lib/customer-labels";

import {
  CUSTOMER_COLUMN_KEYS,
  type CustomerColumnKey,
} from "../constants";
import type { CustomerListRow } from "../types";
import { CustomerStatusSwitch } from "./customer-status-switch";

type CustomerTableProps = {
  rows: CustomerListRow[];
  accountContext: boolean;
  loading: boolean;
  visibleColumns: ReadonlySet<CustomerColumnKey>;
  onToggleStatus: (row: CustomerListRow) => void;
  onViewProfiles: (accountId: string) => void;
  onEdit: (row: CustomerListRow) => void;
  onDelete?: (row: CustomerListRow) => void;
  onService?: (row: CustomerListRow) => void;
};

export function CustomerTable({
  rows,
  accountContext,
  loading,
  visibleColumns,
  onToggleStatus,
  onViewProfiles,
  onEdit,
  onDelete,
  onService,
}: CustomerTableProps) {
  const { locale } = useTranslation();
  const { timeZone } = usePosRuntimeConfig();
  const visibleColumnCount = CUSTOMER_COLUMN_KEYS.filter((column) =>
    visibleColumns.has(column),
  ).length;

  function openRow(row: CustomerListRow) {
    if (row.kind === "account") {
      onViewProfiles(row.id);
    } else {
      onService?.(row);
    }
  }

  function handleRowClick(
    event: ReactMouseEvent<HTMLElement>,
    row: CustomerListRow,
  ) {
    if (
      (event.target as HTMLElement).closest(
        "button, a, input, select, textarea, [role='switch']",
      )
    ) {
      return;
    }
    openRow(row);
  }

  function handleRowKeyDown(
    event: ReactKeyboardEvent<HTMLElement>,
    row: CustomerListRow,
  ) {
    if (
      event.target !== event.currentTarget ||
      (event.key !== "Enter" && event.key !== " ")
    ) {
      return;
    }
    event.preventDefault();
    openRow(row);
  }

  if (loading && rows.length === 0) {
    return (
      <div className="grid gap-2 p-3">
        {[0, 1, 2, 3, 4].map((row) => (
          <div className="h-9 animate-pulse rounded-md bg-muted" key={row} />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="p-4">
        <div className="border-y border-dashed px-4 py-14 text-center">
          <h2 className="text-base font-semibold text-foreground">
            没有符合当前查询条件的数据
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            请调整关键词或筛选条件后重试。
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="divide-y min-[900px]:hidden">
        {rows.map((row) => (
          <CustomerCard
            key={`${row.kind}-${row.id}`}
            locale={locale}
            timeZone={timeZone}
            onClick={(event) => handleRowClick(event, row)}
            onDelete={onDelete ? () => onDelete(row) : undefined}
            onEdit={() => onEdit(row)}
            onKeyDown={(event) => handleRowKeyDown(event, row)}
            onToggleStatus={() => onToggleStatus(row)}
            row={row}
          />
        ))}
      </div>

      <div className="hidden min-[900px]:block">
        <Table
          className="text-xs [&_td]:px-2 [&_td]:py-1.5 [&_th]:h-8 [&_th]:px-2"
          style={{
            minWidth: `${Math.max(620, visibleColumnCount * 118)}px`,
          }}
        >
          <TableHeader>
            <TableRow>
              {CUSTOMER_COLUMN_KEYS.map((column) =>
                visibleColumns.has(column) ? (
                  <TableHead
                    className={column === "actions" ? "text-right" : undefined}
                    key={column}
                  >
                    {column === "account" && accountContext
                      ? "档案信息"
                      : getCustomerColumnLabel(column)}
                  </TableHead>
                ) : null,
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                className="cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none"
                key={`${row.kind}-${row.id}`}
                onClick={(event) => handleRowClick(event, row)}
                onKeyDown={(event) => handleRowKeyDown(event, row)}
                tabIndex={0}
              >
                {visibleColumns.has("customer") ? (
                  <TableCell className="max-w-56">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {row.kind === "account" ? "账户" : "档案"}
                      </span>
                      <span className="truncate font-medium text-foreground">
                        {row.kind === "account"
                          ? row.accountName
                          : row.fullName}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
                      {row.id}
                    </span>
                  </TableCell>
                ) : null}
                {visibleColumns.has("contact") ? (
                  <TableCell className="max-w-52">
                    <span className="block truncate text-foreground">
                      {row.phone || "未填写手机号"}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                      {row.email || "未填写邮箱"}
                    </span>
                  </TableCell>
                ) : null}
                {visibleColumns.has("account") ? (
                  <TableCell className="max-w-44 truncate text-muted-foreground">
                    {row.kind === "account"
                      ? accountContext
                        ? "—"
                        : "账户本身"
                      : row.accountName || "—"}
                  </TableCell>
                ) : null}
                {visibleColumns.has("status") ? (
                  <TableCell>
                    <CustomerStatusSwitch
                      kind={row.kind}
                      onToggle={() => onToggleStatus(row)}
                      status={row.status}
                    />
                  </TableCell>
                ) : null}
                {visibleColumns.has("createdAt") ? (
                  <TableCell className="text-muted-foreground">
                    {formatCustomerDate(row.createdAt, locale, timeZone)}
                  </TableCell>
                ) : null}
                {visibleColumns.has("actions") ? (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <button
                        className="min-h-8 rounded-md px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                        onClick={() => onEdit(row)}
                        type="button"
                      >
                        编辑
                      </button>
                      {onDelete ? (
                        <button
                          className="min-h-8 rounded-md px-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                          onClick={() => onDelete(row)}
                          type="button"
                        >
                          删除
                        </button>
                      ) : null}
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function CustomerCard({
  row,
  locale,
  timeZone,
  onToggleStatus,
  onEdit,
  onDelete,
  onClick,
  onKeyDown,
}: {
  row: CustomerListRow;
  locale: string;
  timeZone: string;
  onToggleStatus: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  onClick: (event: ReactMouseEvent<HTMLElement>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
}) {
  const isAccount = row.kind === "account";
  const name = isAccount ? row.accountName : row.fullName;

  return (
    <article
      className="min-h-28 cursor-pointer px-3 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
      onClick={onClick}
      onKeyDown={onKeyDown}
      role="link"
      tabIndex={0}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {isAccount ? "账户" : "档案"}
            </span>
            <span className="truncate text-sm font-medium text-foreground">
              {name}
            </span>
          </div>
          <div className="mt-2 text-xs text-foreground">
            {row.phone || "未填写手机号"}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {row.email || "未填写邮箱"}
          </div>
          {!isAccount ? (
            <div className="mt-1 text-xs text-muted-foreground">
              所属账户：{row.accountName || "—"}
            </div>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">
          {formatCustomerDate(row.createdAt, locale, timeZone)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2">
        <CustomerStatusSwitch
          kind={row.kind}
          onToggle={onToggleStatus}
          status={row.status}
        />
        <div className="flex gap-1">
          <button
            className="min-h-10 rounded-md border bg-background px-3 text-xs font-medium"
            onClick={onEdit}
            type="button"
          >
            编辑
          </button>
          {onDelete ? (
            <button
              className="min-h-10 rounded-md border border-destructive/30 bg-background px-3 text-xs font-medium text-destructive"
              onClick={onDelete}
              type="button"
            >
              删除
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function formatCustomerDate(
  value: string,
  locale: string,
  timeZone: string,
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString(locale, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}
