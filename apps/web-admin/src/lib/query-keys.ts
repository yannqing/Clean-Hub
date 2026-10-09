/**
 * 集中管理 TanStack Query 的 query key 工厂。
 *
 * 约定：`[scope, resource, operation, ...args]`
 * - scope: "tenant" | "saas"（与路由/feature 域对齐）
 * - resource: "branches" | "services" | ...（与 feature 模块对齐）
 * - operation: "list" | "detail"
 * - args: 过滤条件或实体 id
 *
 * 集中化便于后续写操作精确 invalidate（如 invalidateQueries({ queryKey: tenantKeys.branches.all })）。
 */
export const tenantQueryKeys = {
  all: ["tenant"] as const,
  branches: {
    all: ["tenant", "branches"] as const,
    lists: () => [...tenantQueryKeys.branches.all, "list"] as const,
    list: (filters: Record<string, unknown>) =>
      [...tenantQueryKeys.branches.lists(), filters] as const,
    details: () => [...tenantQueryKeys.branches.all, "detail"] as const,
    detail: (branchId: string) =>
      [...tenantQueryKeys.branches.details(), branchId] as const,
  },
} as const;

export const saasQueryKeys = {
  all: ["saas"] as const,
} as const;
