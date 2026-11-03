"use client";

import { Badge, Button } from "@cleanhub/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { webAdminRoutes } from "@/config/routes";
import { useWebAdminLocale } from "@/i18n";

/**
 * 根级 not-found —— 路由匹配不到（404）或某段调用 not-found() 时的全局兜底。
 *
 * 通过 pathname 判断 scope，复用对应域的 common 兜底文案。
 */
export default function NotFound() {
  const pathname = usePathname();
  const { messages } = useWebAdminLocale();
  const common = pathname.startsWith("/tenant")
    ? messages.tenant.common
    : messages.saas.common;

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 px-6 py-12">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-sm">
        <Badge variant="secondary">404</Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal">
          {common.notFoundTitle}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {common.notFoundDescription}
        </p>
        <div className="mt-6">
          <Button asChild type="button">
            <Link href={webAdminRoutes.home}>{common.refresh}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
