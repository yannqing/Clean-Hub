"use client";

import { Badge, Button } from "@cleanhub/ui";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useWebAdminLocale } from "@/i18n";

/**
 * 根级 error boundary —— 捕获任意路由段抛出的未处理错误。
 *
 * 必须是 client component，并接收 Next.js 注入的 { error, reset }。
 * 通过 pathname 判断当前 scope，复用对应域的 common 兜底文案。
 */
type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { messages } = useWebAdminLocale();
  const common = pathname.startsWith("/tenant")
    ? messages.tenant.common
    : messages.saas.common;

  // 将 error 打到控制台，便于开发排查（生产可由 logger 接管）。
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 px-6 py-12">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-sm">
        <Badge variant="destructive">{common.somethingWentWrong}</Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal">
          {common.somethingWentWrong}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {common.loadErrorDescription}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => reset()} type="button">
            {common.tryAgain}
          </Button>
          <Button
            onClick={() => router.refresh()}
            type="button"
            variant="outline"
          >
            {common.refresh}
          </Button>
        </div>
      </div>
    </div>
  );
}
