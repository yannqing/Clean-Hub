"use client";

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import { tenantQueryKeys } from "@/lib/query-keys";

import { getBranchDetailQuery } from "./get-branch-detail.query";
import type { BranchSummary } from "../types";

/**
 * 客户端门店详情查询 hook。
 *
 * 用法：
 * - 服务端预取后，page 把结果作为 `initialData` 传入实现 hydrate；
 * - 客户端后续 refetch/重试/缓存由 TanStack Query 接管。
 */
type UseBranchDetailQueryOptions = Omit<
  UseQueryOptions<BranchSummary>,
  "queryKey" | "queryFn"
> & {
  initialData?: BranchSummary;
};

export function useBranchDetailQuery(
  branchId: string,
  options: UseBranchDetailQueryOptions = {},
) {
  return useQuery({
    queryKey: tenantQueryKeys.branches.detail(branchId),
    queryFn: () => getBranchDetailQuery(branchId),
    enabled: Boolean(branchId),
    ...options,
  });
}
