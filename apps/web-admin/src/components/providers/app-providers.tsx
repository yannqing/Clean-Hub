"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * 全局 client Provider 聚合。目前挂 TanStack Query 的 QueryClientProvider。
 *
 * QueryClient 用 useState 创建单例，避免每次渲染重建（导致缓存丢失）。
 * 写操作（Server Action）成功后通过 revalidatePath 触发 RSC 重取，
 * client 端 useQuery 用 initialData 接住新数据，无需 useMutation。
 */
type AppProvidersProps = {
  children: React.ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 与现有 api-client 的 retry: { retries: 1 } 对齐
            retry: 1,
            // 避免客户端焦点切换时频繁重取（现有应用无此行为）
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
