import { type Database, getDb } from "@cleanhub/db";
import type { AuthContext } from "../../auth/auth.types.js";
import { assertPosContext } from "../../auth/permission.helper.js";
import {
  findPendingTasks,
  findRecentActivities,
  findWorkspaceOverview,
} from "./workspace.repository.js";
import type {
  PosPendingTasksResponse,
  PosRecentActivitiesResponse,
  PosWorkspaceOverview,
} from "./workspace.types.js";

// ---------------------------------------------------------------------------
// Local helpers (same pattern as orders.service.ts)
// ---------------------------------------------------------------------------

function requirePosContext(authContext: AuthContext): string {
  assertPosContext(authContext);
  return authContext.tenantId!;
}

function resolveListBranchScope(
  authContext: AuthContext,
): string[] | undefined {
  if (authContext.role === "owner" || authContext.role === "manager") {
    return authContext.branchIds.length > 0
      ? authContext.branchIds
      : undefined;
  }
  return authContext.branchIds;
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export async function getPosWorkspaceOverview(
  authContext: AuthContext,
  query: { branchId?: string },
  db: Database = getDb(),
): Promise<PosWorkspaceOverview> {
  const tenantId = requirePosContext(authContext);

  return findWorkspaceOverview(db, {
    tenantId,
    allowedBranchIds: resolveListBranchScope(authContext),
    branchId: query.branchId,
  });
}

// ---------------------------------------------------------------------------
// Recent activities
// ---------------------------------------------------------------------------

export async function getPosRecentActivities(
  authContext: AuthContext,
  query: { branchId?: string; limit?: number },
  db: Database = getDb(),
): Promise<PosRecentActivitiesResponse> {
  const tenantId = requirePosContext(authContext);

  return findRecentActivities(db, {
    tenantId,
    allowedBranchIds: resolveListBranchScope(authContext),
    branchId: query.branchId,
    limit: query.limit,
  });
}

// ---------------------------------------------------------------------------
// Pending tasks
// ---------------------------------------------------------------------------

export async function getPosPendingTasks(
  authContext: AuthContext,
  query: { branchId?: string },
  db: Database = getDb(),
): Promise<PosPendingTasksResponse> {
  const tenantId = requirePosContext(authContext);

  return findPendingTasks(db, {
    tenantId,
    allowedBranchIds: resolveListBranchScope(authContext),
    branchId: query.branchId,
  });
}
