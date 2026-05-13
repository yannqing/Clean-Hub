import type { Permission, SessionUser } from "@/types/auth";

export function hasPermission(
  user: SessionUser | null,
  permission: Permission,
): boolean {
  return Boolean(user?.permissions.includes(permission));
}
