"use client";

import { CUSTOMER_STATUS_META } from "../constants";
import type { PosCustomerStatus } from "../types";

type CustomerStatusSwitchProps = {
  status: PosCustomerStatus;
  kind: "account" | "profile";
  disabled?: boolean;
  onToggle: () => void;
};

/**
 * Inline active/disabled switch. Clicking flips between active and disabled
 * via a status-change call (handled by the parent).
 */
export function CustomerStatusSwitch({
  status,
  kind,
  disabled,
  onToggle,
}: CustomerStatusSwitchProps) {
  const enabled = status === "active";
  const meta = CUSTOMER_STATUS_META[status];

  return (
    <div className="flex items-center gap-2">
      <button
        aria-checked={enabled}
        aria-label={`${enabled ? "停用" : "启用为正常"}${kind === "account" ? "客户账户" : "客户档案"}`}
        className="flex h-11 w-14 shrink-0 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        role="switch"
        title={`点击${enabled ? "停用" : "启用为正常"}`}
        type="button"
        onClick={onToggle}
      >
        <span
          className={`relative h-6 w-11 rounded-full transition ${
            enabled ? "bg-emerald-500" : "bg-slate-300"
          }`}
        >
          <span
            className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${
              enabled ? "left-6" : "left-1"
            }`}
          />
        </span>
      </button>
      <span
        className={`text-xs font-medium ${meta.badgeClassName} rounded-md px-2 py-0.5`}
      >
        {meta.label}
      </span>
    </div>
  );
}
