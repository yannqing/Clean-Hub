"use client";

import { cn } from "@cleanhub/ui";
import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "./icons";

export type PosBreadcrumbItem = {
  href?: string;
  label: ReactNode;
  onClick?: () => void;
};

type PosBreadcrumbProps = {
  className?: string;
  items: PosBreadcrumbItem[];
};

export function PosBreadcrumb({ className, items }: PosBreadcrumbProps) {
  const breadcrumbs: PosBreadcrumbItem[] = [{ label: "POS" }, ...items];

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex items-center gap-1.5 text-xs font-semibold text-slate-400",
        className,
      )}
    >
      {breadcrumbs.map((item, index) => {
        const current = index === breadcrumbs.length - 1;
        const contentClassName = current
          ? "text-slate-600"
          : "transition hover:text-blue-700";

        return (
          <span className="flex min-w-0 items-center gap-1.5" key={index}>
            {index > 0 ? (
              <Icon className="h-3.5 w-3.5 shrink-0" name="chevron-right" />
            ) : null}
            {item.href && !current ? (
              <Link className={contentClassName} href={item.href}>
                {item.label}
              </Link>
            ) : item.onClick && !current ? (
              <button
                className={cn(contentClassName, "text-left")}
                onClick={item.onClick}
                type="button"
              >
                {item.label}
              </button>
            ) : (
              <span className={contentClassName}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
