import { type Database, getDb } from "@cleanhub/db";
import type { AuthContext } from "../../auth/auth.types.js";
import {
  requirePosBranchAccess,
  requirePosTenantId,
  resolvePosBranchScope,
} from "../access-control.helper.js";
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
// Overview
// ---------------------------------------------------------------------------

export async function getPosWorkspaceOverview(
  authContext: AuthContext,
  query: { branchId?: string },
  db: Database = getDb(),
): Promise<PosWorkspaceOverview> {
  const tenantId = requirePosTenantId(authContext);
  if (query.branchId) {
    requirePosBranchAccess(authContext, query.branchId);
  }

  return findWorkspaceOverview(db, {
    tenantId,
    allowedBranchIds: resolvePosBranchScope(authContext),
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
  const tenantId = requirePosTenantId(authContext);
  if (query.branchId) {
    requirePosBranchAccess(authContext, query.branchId);
  }

  return findRecentActivities(db, {
    tenantId,
    allowedBranchIds: resolvePosBranchScope(authContext),
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
  const tenantId = requirePosTenantId(authContext);
  if (query.branchId) {
    requirePosBranchAccess(authContext, query.branchId);
  }

  return findPendingTasks(db, {
    tenantId,
    allowedBranchIds: resolvePosBranchScope(authContext),
    branchId: query.branchId,
  });
}
