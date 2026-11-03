"use client";

import { RouteErrorPanel } from "@/components/feedback/route-error-panel";

/**
 * 根级 error boundary —— 捕获任意路由段抛出的未处理错误。
 *
 * 必须是 client component，并接收 Next.js 注入的 { error, reset }。
 * 具体面板由 RouteErrorPanel 提供，它会根据 pathname 选择对应域的文案；
 * 各个工作区还有自己的 error.tsx，让失败只影响内容区而不是整个应用。
 */
type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps) {
  return <RouteErrorPanel error={error} reset={reset} />;
}
