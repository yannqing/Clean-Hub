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
  return (
    <nav
      aria-label="POS breadcrumb / POS 面包屑"
      className={cn("min-w-0", className)}
    >
      <ol className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <li className="shrink-0">
          <Link
            aria-label="POS 首页 / POS home"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="/"
            title="POS 首页"
          >
            <Icon className="h-4 w-4" name="layout-dashboard" />
          </Link>
        </li>

        {items.map((item, index) => {
          const current = index === items.length - 1;
          const contentClassName = current
            ? "max-w-72 truncate text-foreground"
            : "max-w-56 truncate text-muted-foreground transition-colors hover:text-foreground";

          return (
            <li
              className={cn(
                "flex min-w-0 items-center gap-1.5",
                current && "flex-1",
              )}
              key={index}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" name="chevron-right" />
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
                <span
                  aria-current={current ? "page" : undefined}
                  className={contentClassName}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
