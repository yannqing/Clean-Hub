"use client";

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import { tenantQueryKeys } from "@/lib/query-keys";

import { getBranchListQuery } from "./get-branch-list.query";
import type { BranchListFilters, BranchSummary } from "../types";

/**
 * 客户端门店列表查询 hook。
 *
 * 用法：
 * - 服务端预取后，page 把结果作为 `initialData` 传入实现 hydrate；
 * - 客户端后续 refetch/重试/缓存由 TanStack Query 接管。
 *
 * 写操作（Server Action）成功后通过 revalidatePath 触发 RSC 重取，
 * 新的 initialData 流入本 hook，数据自动更新，无需 useMutation。
 */
type UseBranchListQueryOptions = Omit<
  UseQueryOptions<BranchSummary[]>,
  "queryKey" | "queryFn"
> & {
  initialData?: BranchSummary[];
};

export function useBranchListQuery(
  filters: BranchListFilters = {},
  options: UseBranchListQueryOptions = {},
) {
  return useQuery({
    queryKey: tenantQueryKeys.branches.list(filters),
    queryFn: () => getBranchListQuery(filters),
    ...options,
  });
}
