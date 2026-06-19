import type { PosIconName } from "./icons";

import { Icon } from "./icons";

type PosPagePlaceholderProps = {
  icon: PosIconName;
  title: string;
  description?: string;
  breadcrumb?: string;
};

export function PosPagePlaceholder({
  icon,
  title,
  description,
  breadcrumb = title,
}: PosPagePlaceholderProps) {
  return (
    <section>
      <div className="mb-5 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
        <span>POS</span>
        <Icon className="h-3.5 w-3.5" name="chevron-right" />
        <span className="text-slate-600">{breadcrumb}</span>
      </div>

      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <Icon className="h-6 w-6" name={icon} />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            {description}
          </p>
        ) : null}
        <span className="mt-6 rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          占位
        </span>
      </div>
    </section>
  );
}
