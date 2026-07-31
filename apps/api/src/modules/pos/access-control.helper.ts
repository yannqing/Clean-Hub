import { z } from "zod";

import { AuthError } from "../auth/auth.errors.js";
import type { AdminRole, AuthContext } from "../auth/auth.types.js";
import { assertPosContext } from "../auth/permission.helper.js";

export type PosRole = Extract<AdminRole, "owner" | "manager" | "cashier">;

export type PosTerminalContext = {
  tenantId: string;
  terminalId: string;
  branchId: string;
  deviceId: string;
  credentialVersion: number;
};

export type PosSensitiveOperation =
  | "cancel"
  | "delete"
  | "discount"
  | "manual_drawer_open"
  | "payment_correction"
  | "price_override"
  | "privileged_reprint"
  | "refund";

type TerminalBoundAuthContext = AuthContext & {
  terminalBranchId?: string | null;
};

const sensitiveOperationReasonSchema = z
  .string({ error: "A reason is required for this operation." })
  .trim()
  .min(1, "A reason is required for this operation.")
  .max(500, "Reason must be at most 500 characters.");

function terminalBranchId(authContext: AuthContext): string | undefined {
  return (
    (authContext as TerminalBoundAuthContext).terminalBranchId ?? undefined
  );
}

function forbidden(message: string): never {
  throw new AuthError("FORBIDDEN", message);
}

export function requirePosTenantId(authContext: AuthContext): string {
  assertPosContext(authContext);
  return authContext.tenantId!;
}

export function requirePosRole(
  authContext: AuthContext,
  allowedRoles: readonly PosRole[],
): void {
  assertPosContext(authContext);

  if (!allowedRoles.includes(authContext.role as PosRole)) {
    forbidden("User does not have enough permission for this POS operation.");
  }
}

export function requirePosTerminalContext(
  authContext: AuthContext,
): PosTerminalContext {
  const tenantId = requirePosTenantId(authContext);
  const terminalId = authContext.terminalId;
  const branchId = authContext.terminalBranchId;
  const deviceId = authContext.terminalDeviceId;
  const credentialVersion = authContext.terminalCredentialVersion;

  if (
    !terminalId ||
    !branchId ||
    !deviceId ||
    typeof credentialVersion !== "number"
  ) {
    throw new AuthError(
      "POS_TERMINAL_ENROLLMENT_REQUIRED",
      "An enrolled POS terminal session is required for POS operations.",
    );
  }

  requirePosBranchAccess(authContext, branchId);

  return {
    tenantId,
    terminalId,
    branchId,
    deviceId,
    credentialVersion,
  };
}

/**
 * `undefined` means tenant-wide access. Only an Owner outside a bound POS
 * terminal may receive that scope. An empty array always means no access.
 */
export function resolvePosBranchScope(
  authContext: AuthContext,
): string[] | undefined {
  assertPosContext(authContext);

  const boundBranchId = terminalBranchId(authContext);
  if (boundBranchId) {
    if (
      authContext.role !== "owner" &&
      !authContext.branchIds.includes(boundBranchId)
    ) {
      return [];
    }
    return [boundBranchId];
  }

  if (authContext.role === "owner") {
    return undefined;
  }

  return [...new Set(authContext.branchIds)];
}

export function requireAnyPosBranchAccess(authContext: AuthContext): void {
  const scope = resolvePosBranchScope(authContext);
  if (scope !== undefined && scope.length === 0) {
    forbidden("User is not assigned to a POS branch.");
  }
}

export function requirePosBranchAccess(
  authContext: AuthContext,
  branchId: string,
): void {
  assertPosContext(authContext);

  const boundBranchId = terminalBranchId(authContext);
  if (boundBranchId && boundBranchId !== branchId) {
    forbidden("The authenticated terminal is bound to another branch.");
  }

  if (authContext.role === "owner") {
    return;
  }

  if (!authContext.branchIds.includes(branchId)) {
    forbidden("User is not assigned to this branch.");
  }
}

export function authorizePosSensitiveOperation(
  authContext: AuthContext,
  _operation: PosSensitiveOperation,
  reason: string | null | undefined,
): string {
  requirePosRole(authContext, ["owner", "manager"]);
  return sensitiveOperationReasonSchema.parse(reason);
}

export function createPosAuditMetadata(
  authContext: AuthContext,
  metadata: Record<string, unknown> = {},
): Record<string, unknown> {
  const terminalContext = authContext as TerminalBoundAuthContext & {
    terminalId?: string;
    terminalDeviceId?: string;
  };

  return {
    ...metadata,
    terminalId: terminalContext.terminalId,
    terminalBranchId: terminalContext.terminalBranchId,
    terminalDeviceId: terminalContext.terminalDeviceId,
  };
}
