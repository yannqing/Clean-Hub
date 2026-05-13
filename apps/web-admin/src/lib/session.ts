import type { AdminScope } from "@/types/auth";

export type SessionContext = {
  scope: AdminScope;
  tenantId?: string;
  branchId?: string;
};

export async function getSessionContext(): Promise<SessionContext | null> {
  return null;
}
