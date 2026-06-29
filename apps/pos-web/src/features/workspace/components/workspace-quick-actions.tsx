"use client";

import Link from "next/link";
import type { PosQuickAction } from "@cleanhub/api-client";

type WorkspaceQuickActionsProps = {
  actions: PosQuickAction[];
};

const COLOR_CLASSES: Record<string, string> = {
  blue: "bg-blue-100 text-blue-600 hover:border-blue-300 hover:bg-blue-50",
  green:
    "bg-green-100 text-green-600 hover:border-green-300 hover:bg-green-50",
  purple:
    "bg-purple-100 text-purple-600 hover:border-purple-300 hover:bg-purple-50",
  orange:
    "bg-orange-100 text-orange-600 hover:border-orange-300 hover:bg-orange-50",
  red: "bg-red-100 text-red-600 hover:border-red-300 hover:bg-red-50",
};

export function WorkspaceQuickActions({
  actions,
}: WorkspaceQuickActionsProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-700">快速操作</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {actions.map((action) => (
          <Link
            key={action.id}
            href={action.route}
            className={`flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center transition ${
              COLOR_CLASSES[action.color] ?? ""
            }`}
          >
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                COLOR_CLASSES[action.color]?.split(" ")[0] ?? "bg-blue-100"
              } ${COLOR_CLASSES[action.color]?.split(" ")[1] ?? "text-blue-600"}`}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </span>
            <span className="text-xs font-medium text-slate-700">
              {action.label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
